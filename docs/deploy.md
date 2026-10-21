# GCP 배포 가이드

GCP **Always Free** 범위의 e2-micro VM 한 대에 docker compose로 `db`(PostGIS)와 `backend`(Spring Boot)를 올립니다. 로컬에서 쓰는 compose 구성에 `docker-compose.prod.yml`만 덧붙이는 방식입니다.

```
브라우저 ──80──▶ VM ┬─ backend (Spring Boot :8080)
                    └─ db (PostGIS :5432, 외부 비공개) ── pgdata 볼륨
```

## 무료 조건 (하나라도 어기면 과금)

| 항목 | 값 |
|---|---|
| 리전 | `us-central1`, `us-west1`, `us-east1` 중 하나 (서울 ❌) |
| 머신 | `e2-micro` 1대 (결제 계정 전체에서 1대) |
| 디스크 | **표준 영구 디스크**(`pd-standard`) 30GB 이하. 콘솔 기본값인 "균형 있는 영구 디스크"는 유료 |
| 외부 IP | 임시 IP 사용. 고정 IP 예약은 하지 않음 (VM을 중지했다 켜면 IP가 바뀜) |

외부 IP·네트워크 사용량으로 소액이 나올 수 있으니 **예산 알림**(6단계)은 꼭 만듭니다.

## 0. 준비

- 아래 `gcloud` 명령은 콘솔 오른쪽 위의 **Cloud Shell**(`>_` 아이콘)에서 실행합니다. 로컬에 gcloud를 설치하지 않아도 됩니다.

```bash
gcloud config set project allforland-sideproject
gcloud services enable compute.googleapis.com
```

## 1. 방화벽

```bash
gcloud compute firewall-rules create allow-http \
  --allow=tcp:80 --target-tags=http-server
```

DB 포트(5432/5433)는 열지 않습니다.

## 2. VM 생성

```bash
gcloud compute instances create all4land \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-standard \
  --tags=http-server

gcloud compute instances describe all4land --zone=us-central1-a \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)'   # 외부 IP
```

## 3. VM 접속, 스왑, Docker 설치

```bash
gcloud compute ssh all4land --zone=us-central1-a
```

여기부터는 VM 안에서 실행합니다. RAM이 1GB라 스왑 없이는 이미지 빌드 중 메모리가 부족하므로 **먼저** 스왑 2GB를 추가합니다.

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit   # 그룹 적용을 위해 한 번 나갔다가 다시 ssh 접속
```

## 4. 코드 받기와 .env 작성

```bash
git clone https://github.com/Yunjaeyun/All4Land_4.git
cd All4Land_4
cp .env.example .env
nano .env
```

`.env`는 아래처럼 채웁니다. 비밀번호는 로컬과 다른 값을 쓰세요.

```
POSTGRES_DB=all4land
POSTGRES_USER=all4land
POSTGRES_PASSWORD=<운영용 비밀번호>
DB_PORT=5433

COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
GOOGLE_MAPS_API_KEY=<Maps 키>
```

`COMPOSE_FILE` 줄이 있으면 `docker compose` 명령이 운영 설정까지 자동으로 합칩니다.

## 5. 실행

```bash
docker compose up -d --build     # 첫 빌드는 e2-micro에서 5~10분 걸림
docker compose ps                # db: healthy, backend: running
docker compose logs -f backend   # "Started AllForLandSideProjApplication"이 보이면 성공
```

브라우저에서 `http://<외부 IP>`로 접속합니다.

## 6. 마무리 설정

**Google Maps 키 제한**: 콘솔 → API 및 서비스 → 사용자 인증 정보 → 키 선택 → 애플리케이션 제한사항을 "웹사이트"로 두고 `http://<외부 IP>/*`를 추가합니다. 키는 브라우저에 노출되므로 꼭 제한합니다.

**예산 알림**: 콘솔 → 결제 → Budgets & caps에서 월 5,000원 예산을 만들고 50%, 90%, 100% 알림을 켭니다.

## 7. 자동 배포 (CI/CD)

main에 push(머지)되면 GitHub Actions의 `deploy.yml`이 이미지 빌드 후 GHCR(`ghcr.io/yunjaeyun/all4land_4`)에 push → VM에 SSH 접속해 `docker compose pull && up -d`를 실행합니다. 별도 테스트 단계는 없고, 컴파일이 깨지면 이미지 빌드에서 멈춥니다.

VM은 이미지를 받아서 실행만 하므로 빌드로 메모리가 부족해질 일이 없습니다. DB 컨테이너와 `pgdata` 볼륨은 건드리지 않습니다.

### 처음 한 번만 설정

**1) 배포용 SSH 키 만들기** (Cloud Shell에서)

```bash
ssh-keygen -t ed25519 -f ~/deploy_key -N "" -C github-actions
gcloud compute ssh all4land --zone=us-central1-a \
  --command 'cat >> ~/.ssh/authorized_keys' < ~/deploy_key.pub
cat ~/deploy_key   # 개인키 전체(BEGIN~END 줄 포함)를 복사
```

복사한 뒤에는 `rm ~/deploy_key ~/deploy_key.pub`로 지웁니다.

SSH(22번 포트) 방화벽 규칙이 있는지도 확인합니다. 기본 네트워크에는 `default-allow-ssh`가 있습니다.

```bash
gcloud compute firewall-rules list --filter="allowed[].ports:22"
```

**2) GitHub Secrets 등록**: 레포 → Settings → Secrets and variables → Actions → New repository secret. 레포 관리자 권한이 필요합니다.

| 이름 | 값 |
|---|---|
| `VM_HOST` | VM 외부 IP |
| `VM_USER` | VM 사용자 이름 (Cloud Shell 프롬프트의 `@` 앞부분) |
| `VM_SSH_KEY` | 1)에서 복사한 개인키 |

**3) VM을 main 브랜치로**: VM에서 다른 브랜치를 쓰고 있었다면 `cd ~/All4Land_4 && git checkout main && git pull`을 실행합니다. 배포 스크립트는 `~/All4Land_4`에서 main을 기준으로 동작합니다.

**4) GHCR 패키지 공개**: 첫 배포의 `image` 단계가 끝나면 GitHub 프로필 → Packages → `all4land_4` → Package settings → Change visibility → **Public**으로 바꿉니다. 비공개로 두면 VM이 이미지를 받지 못해 `deploy` 단계가 실패합니다. 바꾼 뒤 Actions 탭에서 실패한 실행을 **Re-run**합니다.

### 롤백

GHCR에는 커밋 SHA 태그도 함께 올라갑니다. VM에서 이전 커밋 이미지로 되돌리려면:

```bash
cd ~/All4Land_4
IMAGE_TAG=<이전 커밋 SHA 전체> docker compose up -d
```

## 업데이트 배포

평소에는 PR을 main에 머지하면 자동으로 배포됩니다. Actions 탭에서 진행 상황을 볼 수 있고, Deploy 워크플로의 **Run workflow** 버튼으로 수동 실행도 됩니다.

GitHub Actions를 쓸 수 없을 때는 VM에서 직접 빌드합니다 (5~10분):

```bash
cd ~/All4Land_4
git pull
docker compose up -d --build
```

## 자주 쓰는 명령

| 하고 싶은 것 | 명령 |
|---|---|
| 로그 보기 | `docker compose logs -f backend` |
| 재시작 | `docker compose restart backend` |
| DB 접속 | `docker compose exec db psql -U all4land -d all4land` |
| 전체 중지 (데이터 유지) | `docker compose down` |
| DB 초기화 (**데이터 삭제**) | `docker compose down -v` |

## 주의

- `ddl-auto: update`라서 엔티티를 바꾸고 배포하면 운영 테이블도 바뀝니다. 컬럼 삭제나 타입 변경은 자동으로 반영되지 않으니 필요하면 직접 SQL로 처리하고, ERD Cloud에도 반영합니다.
- 한국에서 미국 리전으로 접속하므로 응답이 조금 느립니다(왕복 약 150ms).
