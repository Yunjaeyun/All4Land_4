# All4Land_4

런던 LSOA별 치안 수준과 Airbnb 숙소를 Google Map 위에 표시합니다. 화면의 체크박스로 각 레이어를 켜거나 끌 수 있으며, 숙소 마커 클릭 상세 보기와 가격 정렬을 제공합니다.

## 실행

Java 21 환경에서 Google Maps API 키를 환경 변수로 설정한 뒤 실행합니다.

```bash
export GOOGLE_MAPS_API_KEY="YOUR_KEY"
./gradlew bootRun
```

브라우저에서 <http://localhost:8080>을 엽니다. 키는 Git에 커밋하지 않습니다. 환경 변수 대신 Git에서 제외되는 `src/main/resources/application-local.yml`에 아래처럼 둘 수도 있습니다.

```yaml
google:
  maps:
    key: YOUR_KEY
```

## 주제도 데이터

- 경계: GLA Statistical GIS Boundary Files, LSOA 2021
- 범죄: data.police.uk, Metropolitan Police Service, 2026-07
- 인구: ONS LSOA Mid-Year Population Estimates, 2024
- 숙소: Kaggle `youssefkhaled117/airbnb` 데이터셋의 London 필드

주제도는 LSOA별 인구 1,000명당 범죄 건수를 5분위로 구분합니다. 원본 대용량 데이터 대신 웹에 필요한 속성과 단순화한 경계만 `london-lsoa-safety.json`에 포함합니다. `scripts/build_safety_geojson.py`는 GDAL의 `ogr2ogr`과 `ogrmerge.py`를 사용해 결과 파일을 재생성합니다.

숙소 데이터는 제공된 자료의 London 레코드 9,993건에서 좌표, 가격, 객실 유형, 수용 가능 인원, 침실 수, 청결도와 만족도만 포함합니다. 원본에 숙소명 컬럼이 없어 검색은 포함하지 않고, 가격 정렬만 제공합니다. `scripts/build_airbnb_json.py`로 웹용 JSON을 재생성할 수 있습니다.

## Commit Type

- **feat**: 기능, 특징 추가 등 기능의 외부적인 부분에 변화가 있을 경우
- **fix**: 버그 등 기능 오류 수정
- **docs**: 문서에 관련된 내용, 문서 수정
- **style**: 코드 포맷, 세미콜론 누락, import문 정리 등 코드 로직 변경이 없을 경우
- **refactor**: 리팩토링 (개발자 입장에서의 수정 사항, 기능의 외부적인 부분에 변화가 없는 경우)
- **test**: 테스트 코드 수정, 누락된 테스트를 추가할 때, 리팩토링 테스트 추가 등 테스트 관련 업무
- **chore**: 빌드 업무 수정, 패키지 매니저 수정 등 잡다한 작업
