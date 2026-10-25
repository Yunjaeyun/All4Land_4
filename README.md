# All4Land_4

Google Maps 위에 런던 LSOA 2021 기준 숙소·치안·인구·녹지 주제도를 표시합니다. 체크박스로 한 번에 하나의 주제도만 켤 수 있으며, 그 밖의 검색·추천·목록 기능은 포함하지 않습니다.

## 실행

Java 21 환경에서 Google Maps API 키를 환경 변수로 설정합니다.

```bash
export GOOGLE_MAPS_API_KEY="YOUR_KEY"
./run.sh
```

브라우저에서 <http://localhost:8080>을 엽니다. 키는 Git에 커밋하지 않습니다. 환경 변수 대신 Git에서 제외되는 `src/main/resources/application-local.yml`에 아래처럼 저장할 수 있습니다.

```yaml
google:
  maps:
    key: YOUR_KEY
```

`run.sh`는 주제도만 확인할 수 있도록 `map-only` 프로필로 실행되며 PostgreSQL/PostGIS 연결을 요구하지 않습니다. 전체 백엔드를 실행할 때는 기존 DB 환경변수와 기본 프로필을 사용합니다.

### IntelliJ에서 실행 (Community 포함)

앱은 프로젝트 루트의 `.env`를 읽으므로 docker compose와 IntelliJ가 같은 값을 씁니다. 실행 구성에 환경변수를 따로 넣을 필요가 없습니다.

1. `cp .env.example .env` 후 `POSTGRES_USER`, `POSTGRES_PASSWORD`, `GOOGLE_MAPS_API_KEY`를 채웁니다. 값에 따옴표를 붙이지 않습니다.
2. DB를 띄웁니다: `docker compose up -d db` (PostGIS, `localhost:5433`)
3. IntelliJ에서 프로젝트 폴더를 열고 Gradle 동기화가 끝나면, 오른쪽 위 실행 구성에서 **All4Land**를 선택해 실행합니다. DB 없이 주제도만 보려면 **All4Land (map-only)**를 고릅니다.
4. <http://localhost:8080>

- 실행 구성은 `.run/`에 들어 있어 별도 설정 없이 나타납니다. 안 보이면 `AllForLandSideProjApplication`의 `main` 옆 ▶ 버튼으로 실행해도 됩니다 (작업 디렉터리가 프로젝트 루트여야 `.env`를 찾습니다).
- Project Structure → SDK는 Java 21로 맞춥니다. Lombok 플러그인이 꺼져 있다면 켭니다.
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`를 환경변수로 주면 `.env`보다 우선합니다. 없으면 `.env`의 `POSTGRES_*`, `DB_PORT`로 `jdbc:postgresql://localhost:5433/all4land`에 접속합니다.

## 배포

GCP VM에 docker compose로 배포합니다. main에 머지되면 GitHub Actions가 자동으로 VM에 배포합니다. 절차는 [docs/deploy.md](docs/deploy.md)를 참고하세요.

## 주제도 지표

모든 값은 하나의 GeoJSON 파일 `london-lsoa-themes.json`에 저장해 경계를 중복 전송하지 않습니다.

- 숙소: LSOA별 Airbnb `price_total` 중위값. 표본 5건 미만은 결측 처리합니다.
- 치안: 2024년 Metropolitan Police Service와 City of London Police 사건 수를 ONS 2024 인구로 나눈 연간 인구 1,000명당 사건 수입니다.
- 인구: ONS 2024 인구를 영국 국가좌표계(EPSG:27700)에서 계산한 LSOA 면적으로 나눈 인구밀도입니다.
- 녹지: OS Open Greenspace Site 폴리곤과 LSOA의 교차 면적 비율입니다. 일반화된 경계를 사용하므로 근사값입니다.

숙소·치안·인구는 5분위, 녹지는 0%와 양수값 사분위로 5등급을 만듭니다. 색상은 국내 GIS 인구지도에서 흔히 쓰는 저값→고값 순차색 관행을 따르며, 치안사건률은 녹색→노랑→빨강으로 표시합니다.

## 데이터 출처

- GLA Statistical GIS Boundary Files: London LSOA 2021
- data.police.uk: 2024-01~2024-12 street crime CSV
- ONS: LSOA Mid-Year Population Estimates 2024
- OS Open Greenspace 2026-04: TQ·SU·TL Greenspace Site
- Kaggle `youssefkhaled117/airbnb`: London 좌표와 총가격

웹용 파일에는 계산에 필요한 집계값과 단순화한 경계만 포함합니다. `scripts/build_thematic_geojson.py`로 원본 데이터에서 다시 생성할 수 있으며, 전처리에는 GDAL, Shapely, pyproj가 필요합니다.

## Commit Type

- **feat**: 기능 추가
- **fix**: 오류 수정
- **docs**: 문서 수정
- **style**: 코드 동작 없는 형식 수정
- **refactor**: 외부 동작 없는 코드 개선
- **test**: 테스트 추가·수정
- **chore**: 빌드 및 기타 작업
