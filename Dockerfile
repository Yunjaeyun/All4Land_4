# ---- build ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# 의존성 레이어 캐시: 소스가 바뀌어도 Gradle 의존성은 다시 받지 않는다
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon > /dev/null

COPY src src
# 테스트는 돌리지 않는다 (필요하면 로컬에서 ./gradlew test)
RUN ./gradlew bootJar -x test --no-daemon

# ---- run ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/build/libs/*-SNAPSHOT.jar app.jar

EXPOSE 8080
# 컨테이너 메모리 제한(compose의 mem_limit) 기준으로 힙 크기를 잡는다
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
