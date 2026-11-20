# Imagem local do serviço oficial da Receita Federal (sem imagem Docker publicada -- ver
# https://github.com/ReceitaFederal/calculadora-rtc-regime-regular). Diferente do
# simples-nacional, este repositório é autossuficiente (flyway/ próprio, sem depender de
# outro clone). Build context = pasta onde este repositório RFB foi clonado (ver
# docker/rtc-regime-regular/README.md), não este repositório.

FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build
COPY . .
RUN mkdir -p ./calculadora/db \
 && ./mvnw flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf --batch-mode --errors \
 && ./mvnw clean package -DskipTests --batch-mode

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /build/calculadora/db ./calculadora/db
COPY --from=build /build/target/*.jar ./app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-Dspring.profiles.active=offline", "-jar", "app.jar"]
