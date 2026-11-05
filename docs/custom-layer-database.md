# 단일 개인 레이어 DB 연결 준비

사용자당 개인 레이어 하나에 항목을 여러 개 보관한다.
이름·월·시간·사진·색상·도형은 레이어 전체가 아닌 개별 항목의 속성이다.
기본은 세션별 메모리 저장이며 `layer-db` 프로필로 PostgreSQL/PostGIS 저장소를 선택한다.
SQL은 자동 적용하지 않는다. DB 모드는 `map-only`와 함께 사용하지 않는다.

## ERD Cloud 반영 사항

기존 `users → user_custom_layers → custom_markers`와 기존 컬럼은 보존한다.
신규 편집기는 `users → 개인 user_custom_layers 1개 → custom_layer_features 여러 개`를 사용한다.

| 테이블 | 추가 항목 | 의미 |
|---|---|---|
| user_custom_layers | is_personal BOOLEAN | 개인 레이어 여부. TRUE인 행은 사용자별로 하나만 허용 |
| custom_layer_features | feature_id BIGINT PK | 도형 DB ID |
| custom_layer_features | custom_layer_id BIGINT FK | 소속 개인 레이어 |
| custom_layer_features | client_feature_id BIGINT | 화면 항목 ID. 레이어 안에서 유일 |
| custom_layer_features | title VARCHAR(100) | 항목 이름 |
| custom_layer_features | visit_month SMALLINT / visit_time TIME | 항목별 월·분 단위 시간 |
| custom_layer_features | is_visible BOOLEAN / photo_data TEXT | 항목 표시 여부·사진 Data URL |
| custom_layer_features | shape_type VARCHAR(16) / color VARCHAR(7) | 도형 종류·색상 |
| custom_layer_features | geometry GEOMETRY(Geometry,4326) | Point / LineString / Polygon |
| custom_layer_features | radius_m DOUBLE PRECISION | 원의 반지름(m). 원 중심은 Point로 보관 |
| custom_layer_features | display_order INT | 항목 순서 |
| custom_layer_features | created_at / updated_at TIMESTAMP | 생성·수정 시각 |

사용자별 개인 레이어 부분 유일 인덱스, 항목 ID 유일 인덱스, 월·시간 인덱스, 공간 GiST 인덱스를 사용한다.
WGS84는 경도(X), 위도(Y) 순서다. 전체 저장은 개인 레이어의 항목만 원자적으로 교체한다.
사용자 행 잠금으로 동시 쓰기를 직렬화하고 실패 시 전체 롤백한다. 같은 계정의 여러 탭에서는 마지막 저장이 우선한다.
항목 내부 DB PK는 전체 저장 때 바뀔 수 있으며 외부 참조에는 client_feature_id를 사용한다.

## 적용 순서

1. DB 담당자와 확장 합의 후 ERD Cloud에 반영한다.
2. 기존 ERD 테이블이 있는 개발 DB에서 `docs/sql/custom-layer-storage.sql`을 수동 적용한다.
3. `layer-db` 프로필을 활성화한다. 이 모드는 `ddl-auto: validate`이므로 스키마를 자동 변경하지 않는다.
4. 인증된 `HttpServletRequest.getUserPrincipal().getName()`을 `users.login_id`와 연결한다.
   미로그인은 401, 사용자 행이 없으면 403이며 요청의 userId는 신뢰하지 않는다.
5. 서로 다른 월·시간의 항목을 저장하고 조건 조회·새로고침·서버 재시작 복원을 확인한다.

로그인 전 로컬 확인은 `layer-db,layer-db-dev`와 개인 설정의
`custom-layer.development-user-id` 또는 `CUSTOM_LAYER_DEV_USER_ID`로 기존 테스트 사용자 PK를 지정한다.
사용자 자동 생성은 하지 않는다. `prod` 활성화 시 개발용 사용자 설정은 무시한다.
세션 만료는 DB의 개인 레이어나 항목을 삭제하지 않는다.

## 이전 준비 코드와의 차이

이전 다중 레이어 모델의 visit_month/visit_time/photo_data/client_layer_id는 새 편집기에서 사용하지 않는다.
이전 스키마를 적용했다면 SQL은 필요한 항목 컬럼을 추가하고 기존 데이터는 보존한다.
기존 다중 레이어 행은 is_personal=FALSE로 남아 새 편집기에서 반환되지 않는다.
실제 사용 데이터가 있다면 DB 담당자와 별도 변환 후 사용한다. 자동 삭제·데이터 이동은 하지 않는다.
사진은 현재 Data URL 방식이며 파일 저장소/업로드와 로그인 전체 구현은 후속 작업이다.
행정구역별 집계·순위는 아직 구현하지 않았다. 이후 개인 레이어의 항목별 공간 교차를 집계할 수 있다.
