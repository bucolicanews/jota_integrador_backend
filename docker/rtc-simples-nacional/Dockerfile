# Imagem local do serviço oficial da Receita Federal (sem imagem Docker publicada pelo
# repositório original -- ver https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional).
# Build context deste Dockerfile é a pasta onde os dois repositórios RFB foram clonados
# lado a lado (ver instruções em docker/rtc-simples-nacional/README.md), não este repositório.
#
# O próprio repositório simples-nacional exige a pasta flyway/ do repositório
# calculadora-rtc-regime-regular pra gerar o banco SQLite (schema compartilhado entre os
# dois calculadores) -- por isso o segundo clone no build context.

FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build

COPY calculadora-rtc-simples-nacional/ ./calculadora-rtc-simples-nacional/
COPY calculadora-rtc-regime-regular/flyway/ ./calculadora-rtc-simples-nacional/flyway/

WORKDIR /build/calculadora-rtc-simples-nacional
RUN mkdir -p ./calculadora/db \
 && ./mvnw flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf --batch-mode --errors \
 && ./mvnw clean package -DskipTests --batch-mode

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /build/calculadora-rtc-simples-nacional/calculadora/db ./calculadora/db
COPY --from=build /build/calculadora-rtc-simples-nacional/target/*.jar ./app.jar

EXPOSE 8082
ENTRYPOINT ["java", "-Dspring.profiles.active=offline", "-jar", "app.jar"]
