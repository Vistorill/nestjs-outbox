# nestjs-outbox

API em **NestJS** que demonstra o **Transactional Outbox Pattern** com **PostgreSQL** (via Drizzle ORM) e **Apache Pulsar** como message broker, incluindo um consumidor **idempotente**.

## O problema que o Outbox resolve

Ao criar um pedido, a aplicação precisa (1) gravar no banco e (2) publicar um evento no broker. Fazer as duas coisas separadamente gera inconsistência: o banco pode confirmar e o broker falhar (evento perdido), ou o contrário (evento de algo que não existe).

Com o Outbox, o pedido e o evento são gravados **na mesma transação** do banco. Um processo separado lê a tabela `outbox` e publica os eventos no broker, garantindo entrega **at-least-once**.

## Arquitetura

```
 POST /orders
      │
      ▼
┌──────────────────────────── transação ────────────────────────────┐
│  INSERT INTO ordes            INSERT INTO outbox (status=pending) │
└───────────────────────────────────────────────────────────────────┘
      │
      ▼
OutboxMessagePublishedService  (@Interval, a cada 5s)
  SELECT ... WHERE status='pending' LIMIT 10 FOR UPDATE SKIP LOCKED
  → publica no Pulsar (propriedade eventId = outbox.id)
  → UPDATE status='published'   (ou grava last_error em caso de falha)
      │
      ▼
   Apache Pulsar
      │
      ▼
OrderCreatedConsumer  (subscription Shared)
  INSERT INTO processed_events (event_id, consumer) ON CONFLICT DO NOTHING
  → ack / negative ack
```

### Destaques

- **Atomicidade**: pedido e evento gravados na mesma transação (`OrdersService`).
- **Concorrência segura**: `FOR UPDATE SKIP LOCKED` permite várias instâncias do publisher sem publicar o mesmo evento em paralelo.
- **Idempotência no consumidor**: a tabela `processed_events` (PK composta `event_id + consumer`) evita processar o mesmo evento duas vezes.
- **Validação**: DTOs com `zod` + `nestjs-zod` (`ZodValidationPipe` global).
- **Producers em cache**: um producer Pulsar por tópico, reaproveitado (`MessageBrokerService`).

## Stack

| Camada       | Tecnologia                         |
| ------------ | ---------------------------------- |
| Framework    | NestJS 11                          |
| Linguagem    | TypeScript                         |
| Banco        | PostgreSQL 15                      |
| ORM          | Drizzle ORM + drizzle-kit          |
| Broker       | Apache Pulsar 3.1 (`pulsar-client`)|
| Validação    | Zod 4 + nestjs-zod                 |
| Agendamento  | @nestjs/schedule                   |
| Gerenciador  | pnpm                               |

## Estrutura

```
src/
├── app.module.ts
├── main.ts
├── db/
│   ├── db.module.ts                    # Conexão Drizzle (provider DRIZLE)
│   └── schema.ts                       # Tabelas ordes, outbox, processed_events
├── orders/
│   ├── orders.controller.ts            # POST /orders
│   ├── orders.service.ts               # Grava pedido + evento na mesma transação
│   └── dto/create-order.dto.ts         # Validação com Zod
├── outbox/
│   ├── message.published.service.ts    # Poller que publica eventos pendentes
│   └── message.broker.service.ts       # Publicação no Pulsar
├── consumers/
│   └── order.created.consumers.ts      # Consumidor idempotente
└── pulsar/
    └── pulsar.module.ts                # Cliente Pulsar (provider PULSAR_CLIENT)
drizzle/                                # Migrations SQL geradas pelo drizzle-kit
```

## Modelo de dados

**`ordes`** — pedidos

| Coluna           | Tipo      |
| ---------------- | --------- |
| `id`             | uuid (PK) |
| `customer_email` | text      |
| `amount`         | numeric   |
| `created_at`     | timestamp |

**`outbox`** — eventos a publicar

| Coluna         | Tipo                                         |
| -------------- | -------------------------------------------- |
| `id`           | uuid (PK) — usado como `eventId`             |
| `event_type`   | text                                         |
| `payload`      | jsonb                                        |
| `status`       | enum `pending` \| `published` \| `failed`    |
| `available_at` | timestamp                                    |
| `created_at`   | timestamp                                    |
| `published_at` | timestamp                                    |
| `last_error`   | text                                         |

**`processed_events`** — controle de idempotência

| Coluna         | Tipo                        |
| -------------- | --------------------------- |
| `event_id`     | uuid (PK composta)          |
| `consumer`     | text (PK composta)          |
| `processed_at` | timestamp                   |

## Como rodar

### Pré-requisitos

- Node.js 20+
- pnpm
- Docker e Docker Compose

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Subir PostgreSQL e Pulsar

```bash
docker compose up -d
```

| Serviço    | Porta  |
| ---------- | ------ |
| PostgreSQL | `5445` |
| Pulsar     | `6650` (broker), `8080` (admin) |

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
DATABASE_URL=postgres://outbox:outbox@localhost:5445/outbox
PULSAR_URL=pulsar://localhost:6650
```

| Variável                  | Obrigatória | Padrão | Descrição                               |
| ------------------------- | ----------- | ------ | --------------------------------------- |
| `DATABASE_URL`            | sim         | —      | URL de conexão do PostgreSQL            |
| `PULSAR_URL`              | sim         | —      | URL do broker Pulsar                    |
| `PORT`                    | não         | `3000` | Porta HTTP da API                       |
| `OUTBOX_POLI_INTERVAL_MS` | não         | `5000` | Intervalo do poller do outbox (ms)      |
| `OUTBOX_BATCH_SIZE`       | não         | `10`   | Eventos processados por ciclo           |

### 4. Aplicar as migrations

```bash
npx drizzle-kit migrate
```

### 5. Iniciar a API

```bash
# desenvolvimento (watch)
pnpm run start:dev

# produção
pnpm run build
pnpm run start:prod
```

## Endpoint

### `POST /orders`

Cria um pedido e registra o evento `OrderCreated` no outbox.

**Request**

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{ "customerEmail": "cliente@exemplo.com", "amount": 199.9 }'
```

| Campo           | Tipo   | Regra            |
| --------------- | ------ | ---------------- |
| `customerEmail` | string | e-mail válido    |
| `amount`        | number | maior que zero   |

**Response `201`**

```json
{
  "id": "6f1c2a3e-...",
  "customerEmail": "cliente@exemplo.com",
  "amount": "199.90",
  "createdAt": "2026-10-04T12:00:00.000Z"
}
```

Dados inválidos retornam `400` com os erros de validação do Zod.

**Payload do evento publicado**

```json
{
  "orderId": "6f1c2a3e-...",
  "customerEmail": "cliente@exemplo.com",
  "amount": "199.90"
}
```

## Scripts

| Comando              | Descrição                      |
| -------------------- | ------------------------------ |
| `pnpm run start:dev` | Inicia em modo watch           |
| `pnpm run build`     | Compila para `dist/`           |
| `pnpm run start:prod`| Executa a versão compilada     |
| `pnpm run lint`      | ESLint com correção automática |
| `pnpm run format`    | Formata com Prettier           |
| `pnpm run test`      | Testes unitários (Jest)        |

## Licença

Projeto de estudo, sem licença definida (`UNLICENSED`).
