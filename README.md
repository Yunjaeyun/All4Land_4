# All4Land_4

Google Maps 위에 런던 LSOA 2021 기준 숙소·치안·인구·녹지 주제도를 표시합니다. 체크박스로 한 번에 하나의 주제도만 켤 수 있으며, 상단 "숙소 검색" 메뉴에서 Airbnb 숙소를 조건으로 찾을 수 있습니다.

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

### 로컬에서 전체 실행

`.env.example`을 복사해 `.env`를 만들고 DB 계정과 Google Maps 키를 채운 뒤 DB를 띄웁니다. 앱이 프로젝트 루트의 `.env`를 읽기 때문에 docker compose와 같은 값을 씁니다.

```bash
cp .env.example .env
docker compose up -d db
```

IntelliJ에서는 `.run/`에 있는 `All4Land` 실행 구성으로 실행합니다. DB 없이 주제도만 볼 때는 `All4Land (map-only)`를 씁니다. `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`를 환경변수로 지정하면 `.env`보다 우선합니다.

## 배포

GCP VM에 docker compose로 배포합니다. main에 머지되면 GitHub Actions가 자동으로 VM에 배포합니다. 절차는 [docs/deploy.md](docs/deploy.md)를 참고하세요.

## 숙소 검색

DB 연결 상태(기본 프로필)에서만 동작하며, `map-only` 프로필에서는 메뉴가 열려도 검색이 비활성 안내를 보여줍니다. 첫 실행 때 `accommodations`가 비어 있으면 `src/main/resources/data/london-airbnb-listings.json`(Kaggle, 9,993건)을 적재하고 좌표로 LSOA(치안 등급)를 연결합니다.

Kaggle 원본에 숙소 이름이 없어서 `자치구 · 방 유형 · 침실 수`(예: `Camden · 전체 집 · 침실 1개`)로 이름을 만들어 저장합니다. 실제 숙소명이 아니므로 이름 대신 조건으로 찾는 용도입니다.

`GET /api/accommodations/search` — 모든 파라미터는 선택이며 주어진 조건만 AND로 적용합니다.

| 파라미터 | 설명 |
| --- | --- |
| `keyword` | 숙소 이름·LSOA 이름 부분 일치(대소문자 무시) |
| `roomType` | `ENTIRE_HOME` / `PRIVATE_ROOM` / `SHARED_ROOM` |
| `minPrice`, `maxPrice` | 총가격 범위 |
| `guests`, `minBedrooms` | 최대 인원·침실 수 하한 |
| `superhostOnly` | `true`면 슈퍼호스트만 |
| `maxSafetyLevel` | 치안 등급 상한 (1=매우 안전 … 5=위험) |
| `minSatisfaction` | 만족도 하한 (0~100) |
| `sort` | `PRICE_ASC`(기본) `PRICE_DESC` `SATISFACTION_DESC` `CITY_CENTER_ASC` `METRO_ASC` |
| `page`, `size` | 0부터 시작, `size` 기본 20·최대 100 |

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
