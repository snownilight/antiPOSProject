# Build stage
FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

# Ensure mvnw has execute permissions and uses LF endings (important on Windows)
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw
RUN chmod +x mvnw

RUN ./mvnw dependency:go-offline

COPY src ./src
RUN ./mvnw clean package -DskipTests

# Run stage
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
