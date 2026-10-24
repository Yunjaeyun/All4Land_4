# 트러블슈팅 기록

## 2026-10-24 맛집 기능 배포 후 사이트 접속 불가

### 요약

| 항목 | 내용 |
|---|---|
| 증상 | 배포 후 `http://<외부 IP>` 접속 시 `ERR_CONNECTION_REFUSED` |
| 원인 | 엔티티에서 컬럼 타입을 바꿨는데 VM DB에는 반영되지 않음 (`ddl-auto: update`는 타입·NOT NULL을 바꾸지 않음) |
| 영향 | backend가 기동 중 예외로 종료 → 재시작 반복 → 80번 포트 응답 없음 |
| 해결 | VM DB에 `ALTER TABLE` 실행 후 backend 재시작 |
| 관련 커밋 | `6d0bda1` (치안 구역 적재), `3b05582` (맛집 API) |

### 배경: 이번에 바뀐 것

맛집 추가(UC-03)를 위해 아래를 변경했다.

- **safety_zones 초기 적재**: `restaurants.safety_zone_id`가 NOT NULL인데 `safety_zones`가 비어 있어 맛집을 저장할 수 없었다. 앱 시작 시 테이블이 비어 있으면 `static/data/london-lsoa-themes.json`으로 4,994건을 넣는 `SafetyZoneDataLoader`를 추가했다.
- **`safety_zones.geometry` 타입 변경**: 원본 LSOA 중 4건이 MultiPolygon이라 `geometry(Polygon,4326)` → `geometry(MultiPolygon,4326)`로 바꿨다.
- **`restaurants.user_id` nullable**: 로그인 기능이 없어 등록자를 알 수 없으므로 로그인 도입 전까지 null을 허용한다.
- **맛집 API·UI**: `POST/GET /api/restaurants`, 상단 "맛집 관리" 메뉴. 좌표가 런던 LSOA 밖이면 400.

로컬 DB에는 `ALTER TABLE`을 직접 실행해 두었기 때문에 로컬에서는 문제가 드러나지 않았다.

### 증상

- GitHub Actions의 Deploy는 **성공**으로 끝남 (`Container all4land_4-backend-1 Started`)
- 브라우저에서는 `34.63.89.241에서 연결을 거부했습니다 (ERR_CONNECTION_REFUSED)`
- `docker compose ps`에서 backend가 생성은 17분 전인데 `Up About a minute` → 재시작을 반복 중

> Deploy 성공은 "컨테이너를 띄웠다"까지만 의미한다. 안의 Spring 앱이 정상 기동했는지는 VM 로그로 확인해야 한다.

### 진단 과정

1. **VM·방화벽 확인**: 외부에서 `curl http://<외부 IP>/`가 타임아웃이 아니라 즉시 거부(curl exit 7) → VM과 방화벽은 정상, 80번에서 응답하는 프로세스가 없음
2. **VM 접속**: Cloud Shell은 VM이 아니다. Cloud Shell에서 한 번 더 접속해야 한다.
   ```bash
   gcloud compute ssh all4land --zone=us-central1-a
   cd ~/All4Land_4
   ```
3. **상태·로그 확인**
   ```bash
   docker compose ps
   docker compose logs --tail 80 backend
   ```
4. **로그에서 원인 확인**
   ```
   Caused by: org.postgresql.util.PSQLException:
   ERROR: Geometry type (MultiPolygon) does not match column type (Polygon)
   ```
   메모리 부족(OOM)이었다면 `Killed` 또는 exit code 137이 보인다. 이번에는 해당 없음.

### 원인

`spring.jpa.hibernate.ddl-auto: update`는 **없는 테이블·컬럼을 추가**만 한다. 이미 있는 컬럼의 타입 변경, NOT NULL 해제, 컬럼 삭제는 하지 않는다.

그래서 엔티티를 `MultiPolygon`으로 바꿔도 VM DB의 `safety_zones.geometry`는 예전 `Polygon` 그대로 남았다. 새 코드의 `SafetyZoneDataLoader`가 MultiPolygon을 INSERT하는 순간 실패하고, `ApplicationRunner` 예외로 Spring 앱이 종료된 뒤 `restart: unless-stopped`로 같은 실패를 반복했다.

### 해결

VM의 `~/All4Land_4`에서 실행한다. INSERT는 트랜잭션째 롤백되어 `safety_zones`는 비어 있으므로 타입 변경이 안전하다.

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "ALTER TABLE safety_zones ALTER COLUMN geometry TYPE geometry(MultiPolygon,4326) USING ST_Multi(geometry);" \
  -c "ALTER TABLE restaurants ALTER COLUMN user_id DROP NOT NULL;"'

docker compose restart backend
docker compose logs -f backend | grep -E "적재|Started|ERROR"
```

아래 두 줄이 나오면 정상이다. e2-micro에서는 기동에 2~3분 걸린다.

```
SafetyZoneDataLoader : safety_zones 4994건 적재 완료
Started AllForLandSideProjApplication in ...
```

### 재발 방지: 시작 시 스키마 자동 보정

`global/init/SchemaPatchRunner`를 추가했다. 앱이 시작될 때 데이터 적재(`SafetyZoneDataLoader`)보다 **먼저** 실행되어 아래를 확인한다.

| 확인 | 조치 |
|---|---|
| `safety_zones.geometry`가 `POLYGON`이면 | `MultiPolygon`으로 변환 (`ST_Multi`) |
| `restaurants.user_id`가 NOT NULL이면 | NOT NULL 해제 |

이미 맞춰진 DB에서는 아무것도 하지 않는다. 보정했을 때만 `스키마 보정: ...` 로그가 남는다. 그래서 VM과 팀원 로컬 DB 모두 **따로 SQL을 실행할 필요가 없다.**

검증은 로컬 DB를 VM과 같은 예전 상태(Polygon, `user_id` NOT NULL, 데이터 없음)로 되돌려서 했다.

- 1차 기동: 보정 로그 2줄 → 4,994건 적재 → 맛집 등록 201
- 2차 기동: 보정·적재 로그 없음 (변경 없음)

### 앞으로 지킬 것

- **엔티티에서 기존 컬럼의 타입이나 nullable을 바꾸면** `SchemaPatchRunner`에 같은 방식으로 보정을 추가한다. 추가할 수 없는 변경이면 배포 전에 VM DB에 `ALTER TABLE`을 먼저 실행하고 PR 본문에 SQL을 적는다.
- 배포 후에는 Actions 성공만 보지 말고 사이트 접속 또는 `docker compose logs backend`로 기동을 확인한다.

### 참고: 첫 기동 직후 맛집 등록 실패

첫 기동 때는 서버가 뜬 뒤 약 20초 동안 `safety_zones` 적재가 진행된다. 이 사이에 맛집을 등록하면 "런던 LSOA 구역 밖의 위치는 등록할 수 없습니다"(400)가 난다. 적재 완료 로그 이후에는 정상이며, 두 번째 기동부터는 적재를 건너뛴다.
