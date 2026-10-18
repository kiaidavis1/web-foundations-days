# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. The hardest problem is a very popular concert going on sale, when far more people want seats than there are seats. The system must stay fast, stay fair and never sell the same seat twice.

## 1. Requirements

### Functional
- Users can sign up and log in.
- Users can browse events and see the details of an event.
- Users can see a seat map showing which seats are available.
- Users can choose seats and hold them for a short time.
- Users can pay for held seats and receive their tickets.
- Users can see their past orders and tickets.
- Held seats are released automatically if the user does not pay in time.

### Non-functional
- **Correctness:** A seat must never be sold to two people. This is the most important requirement.
- **Speed:** The seat map should load in under 500 ms and a hold should answer in under 1 second, even during a big sale.
- **Fairness:** Seats go to people on a first-come, first-served basis. One person can hold at most 6 seats and has only one active hold per event, and automated bots are limited.
- **Availability:** The site must stay up during a big sale, and the rest of the site must keep working even if one popular event is overloaded.
- **Scalability:** The system must cope with a sudden spike that is hundreds of times bigger than normal traffic.
- **Durability:** A paid order must never be lost.
- **Security:** All traffic uses HTTPS. Card payments are handled by a payment provider, so we never store card numbers.

## 2. Estimates

### Facts used
- 2 million registered users
- Normal day: 50,000 visitors, each viewing 10 pages, and 5,000 tickets sold
- Big sale: 200,000 people try to buy 20,000 seats within the first 10 minutes
- 86,400 seconds in a day, and peak traffic is 5 times the average on a normal day

### Normal traffic
- Page views: 50,000 x 10 = 500,000 per day. 500,000 / 86,400 = about 6 per second on average, and about 29 per second at peak.
- Ticket sales: 5,000 per day / 86,400 = about 0.06 per second (one ticket every 17 seconds), and about 0.3 per second at peak.
- Storage: each ticket (a seat row and an order row) takes about 0.5 KB, so 5,000 x 0.5 KB = about 2.5 MB per day, or about 0.9 GB per year. Creating the seats for a 20,000-seat event takes only a few MB.

### Big sale
- Arrivals: 200,000 people in 10 minutes (600 seconds) = about 333 new users per second.
- Requests: assume each person makes about 10 requests (open the event, check the seat map a few times, hold seats, pay). That is 2,000,000 requests / 600 = about 3,300 requests per second. We plan for about 5,000 per second to allow for the first-minute rush.
- Hold attempts: assume each person tries about 3 holds, which is 600,000 / 600 = about 1,000 hold attempts per second.
- Successful purchases: at most 20,000 in 10 minutes = about 33 per second.
- Demand: 200,000 people want 20,000 seats, so there are 10 people for every seat and 90% will not get a ticket.

### Comparison
The big sale is about 550 times busier than a normal day (3,300 requests per second against about 6). A system built only for normal traffic would fail, so the design needs special protection for sales like this. Only about 33 purchases per second actually have to be written, so the real challenge is handling the flood of reads and failed attempts, not storing the data.

## 3. API

All endpoints use JSON and HTTPS. Every endpoint except login needs an `Authorization: Bearer <token>` header.

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| GET | `/events` | List upcoming events | 200 OK |
| GET | `/events/{id}` | Get the details of one event | 200 OK |
| GET | `/events/{id}/seats?status=available` | Get the seat map with each seat's status | 200 OK |
| POST | `/events/{id}/holds` | Hold chosen seats for 5 minutes | 201 Created |
| DELETE | `/events/{id}/holds` | Release the seats I am holding | 204 No Content |
| POST | `/orders` | Pay for the held seats and create an order | 201 Created |
| GET | `/orders` | List my orders | 200 OK |
| GET | `/orders/{id}` | Get one order with its tickets | 200 OK |

### Example: hold seats

`POST /events/12/holds`

```json
{
  "seatIds": [301, 302]
}
```

Response `201 Created`:

```json
{
  "eventId": 12,
  "seatIds": [301, 302],
  "expiresAt": "2026-10-25T18:05:00Z"
}
```

If a seat is already taken, the response is `409 Conflict`:

```json
{
  "error": {
    "code": "seat_unavailable",
    "message": "Seat 302 is no longer available.",
    "seatIds": [302]
  }
}
```

### Example: pay for seats

`POST /orders` with the header `Idempotency-Key: 7f3c9a10-...`

```json
{
  "eventId": 12,
  "seatIds": [301, 302],
  "paymentToken": "tok_abc123"
}
```

Response `201 Created`:

```json
{
  "id": 9001,
  "status": "paid",
  "totalCents": 15000,
  "seats": [
    { "id": 301, "section": "A", "row": "5", "number": 11 },
    { "id": 302, "section": "A", "row": "5", "number": 12 }
  ]
}
```

### Error codes
- **400 Bad Request:** the data is invalid, for example more than 6 seats in one hold.
- **401 Unauthorized:** the token is missing or expired.
- **402 Payment Required:** the payment was declined.
- **404 Not Found:** the event or order does not exist.
- **409 Conflict:** a seat is no longer available.
- **410 Gone:** the hold expired before the user paid.
- **429 Too Many Requests:** the user or IP address is sending requests too fast.

## 4. Data model

### Tables

**users:** `id` (primary key), `name`, `email` (unique), `created_at`

**events:** `id` (primary key), `name`, `venue`, `starts_at`, `sale_starts_at`, `total_seats`

**orders:** `id` (primary key), `user_id` (foreign key to users), `event_id` (foreign key to events), `status` (pending, paid or cancelled), `total_cents`, `idempotency_key` (unique), `created_at`

**seats:** `id` (primary key), `event_id` (foreign key to events), `section`, `row_label`, `seat_number`, `price_cents`, `status` (available, held or sold), `held_by` (foreign key to users), `hold_expires_at`, `order_id` (foreign key to orders)

### Relationships
- **One-to-many, events to seats:** One event has many seats, and each seat belongs to one event.
- **One-to-many, users to orders:** One user can place many orders, and each order belongs to one user.
- **One-to-many, orders to seats:** One order can include several seats, but each seat can belong to at most one order. This is what makes double-selling impossible.
- **Many-to-many, users and events:** A user can buy tickets to many events and an event has many buyers. The `orders` and `seats` tables link them, so no separate join table is needed.

### SQL

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  starts_at DATETIME NOT NULL,
  sale_starts_at DATETIME NOT NULL,
  total_seats INTEGER NOT NULL CHECK (total_seats > 0)
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled')),
  total_cents INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  row_label TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'held', 'sold')),
  held_by INTEGER,
  hold_expires_at DATETIME,
  order_id INTEGER,
  UNIQUE (event_id, section, row_label, seat_number),
  CHECK ((status = 'sold') = (order_id IS NOT NULL)),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (held_by) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_orders_user ON orders(user_id);
```

- **idx_seats_event_status:** Showing the seat map and finding available seats always filters by event and status, so this index avoids scanning every seat of every event.
- **idx_orders_user:** "View my tickets" looks up orders by user, and this index keeps that fast as orders grow.

### How double-booking is prevented

Two people clicking the same seat at the same moment is the main danger. The design protects against it in layers, and the database, not the cache, makes the final decision.

1. **An atomic hold.** Taking a seat is one SQL statement that only succeeds if the seat is still free (or its old hold has expired):

```sql
   UPDATE seats
   SET status = 'held', held_by = :user_id,
       hold_expires_at = datetime('now', '+5 minutes')
   WHERE id = :seat_id
     AND (status = 'available'
          OR (status = 'held' AND hold_expires_at < datetime('now')));
```

   The database locks that row while the statement runs, so if two requests arrive together, one runs first and changes 1 row, and the second finds the seat already held and changes 0 rows. A result of 0 rows means the API answers `409 Conflict`. No code has to "check then update", so there is no gap for a second person to slip through.

2. **A transaction when paying.** The payment step runs in one transaction. It creates the order, then marks the seats as sold only if they are still held by this user and the hold has not expired. If the number of changed rows is not equal to the number of seats requested, the transaction is rolled back and nothing is sold:

```sql
   BEGIN;
   INSERT INTO orders (user_id, event_id, status, total_cents, idempotency_key)
   VALUES (:user_id, :event_id, 'paid', :total, :key);

   UPDATE seats
   SET status = 'sold', order_id = :order_id, held_by = NULL, hold_expires_at = NULL
   WHERE id IN (:seat_ids)
     AND status = 'held' AND held_by = :user_id
     AND hold_expires_at > datetime('now');
   -- If the rows changed is not the number of seats: ROLLBACK. Otherwise: COMMIT.
```

3. **Constraints as a safety net.** A seat row has only one `order_id`, so it can belong to only one order. The `CHECK` rule says a seat is `sold` only when it has an order, the `UNIQUE (event_id, section, row_label, seat_number)` rule stops duplicate seat rows, and the unique `idempotency_key` stops a retried request from creating a second order and charging the user twice. Even a bug in the application cannot break these rules.

4. **Holds that expire.** A hold lasts 5 minutes, and when a user starts to pay we extend it by 2 minutes so it cannot expire in the middle of a payment. A worker also frees expired holds regularly. If a payment succeeds but the transaction fails, a worker refunds the user automatically.

5. **The cache is never the judge.** The cache may show a seat as free a second after it was taken, and that is acceptable because the hold statement above still decides. The user simply gets a friendly "seat just taken" message.

(This SQL is written in SQLite style so it can be tested in a SQLite playground. In PostgreSQL, use `NOW()` and `SELECT ... FOR UPDATE`.)

## 5. Architecture

### Diagram

```
               Client (browser / mobile app)
                      |
                      v
                   +-----+            +-----+
                   | DNS |            | CDN |  <- images, static files, event pages
                   +--+--+            +-----+
                      |
                      v
              +----------------+
              | Load balancer  |  (also rate limiting)
              +-------+--------+
                      |
                      v
              +----------------+
              | Waiting room   |  (virtual queue for big sales)
              +-------+--------+
                      |
          +-----------+-----------+
          v                       v
   +-------------+         +-------------+
   | App server 1|   ...   | App server N|   (many, auto-scaling)
   +------+------+         +------+------+
          |                       |
   +------+-------+---------------+---------+------------------+
   v              v                          v                  v
+--------+  +--------------+           +---------+   +------------------+
| Cache  |  |  Database    |           |  Queue  |   | Payment provider |
| (seat  |  |  (primary)   |           +----+----+   |    (external)    |
|  map)  |  +------+-------+                |        +------------------+
+--------+         | copies                 v
                   v                   +----------+
            +--------------+           | Workers  |  (tickets by email,
            | Read replica |           +----------+   free expired holds,
            +--------------+                          refunds)
```

### Components
- **Client:** The browser or mobile app where people browse events, pick seats and pay.
- **DNS:** It turns the TicketHub name into the address of our system, so users never need to know any server address.
- **CDN:** It serves images, static files and event pages from locations near the user, so the flood of visitors never reaches our servers for these files.
- **Load balancer:** It spreads requests across the app servers, skips servers that are down, and limits how fast any one user or IP address can send requests, which stops bots.
- **Waiting room:** It lets only a limited number of people into the buying pages at a time and puts everyone else in a fair queue, so the system is never hit by all 200,000 people at once.
- **App servers:** They run the business logic for holds and orders, and because they store nothing themselves, we can add many more when a big sale starts.
- **Cache:** It stores the seat map and event details for a second or two, so thousands of people looking at the same event do not each hit the database.
- **Database (primary):** It is the single source of truth where every hold and sale is written, which is what guarantees a seat is never sold twice.
- **Read replica:** It is a live copy of the database that answers the browsing queries, which keeps load off the primary and acts as a backup ready to take over.
- **Queue:** It holds slow background jobs so a purchase can finish quickly instead of waiting for them.
- **Workers:** They take jobs from the queue to email tickets, free expired holds and issue refunds.
- **Payment provider:** An external service that takes the card payment, so we never store card details ourselves.

### How the design survives the big sale
- The CDN and cache absorb the large number of read requests (about 3,300 per second), so the database sees far fewer.
- The waiting room admits people at a steady pace, for example about 2,000 at a time, so the database receives at most a few hundred hold attempts per second instead of a sudden flood.
- Only successful actions write to the primary, about 33 purchases per second at most. A single hold is a one-row update, which a properly indexed primary database handles easily.
- The app servers are stateless and auto-scale, so extra capacity is added as the queue grows.
- The queue and workers do slow work in the background, so purchases are not delayed by email or refunds.
- Rate limiting and the limit of 6 seats per hold keep bots from taking all the seats.
- If one app server or the cache fails, the others keep working and the database stays correct. If the primary database fails, the read replica is promoted to primary.

## 6. Trade-offs

- **Holding seats for 5 minutes is fair but can waste seats.** A hold stops others from taking a seat while someone pays, but a person who abandons the page blocks that seat until the hold expires. A shorter hold frees seats faster but rushes buyers, so we chose 5 minutes, extended by 2 minutes while a payment is in progress.
- **The waiting room protects the system but makes people wait.** It keeps the site up and gives everyone a fair turn, but users wait in line and we must build and run one more service.
- **A cached seat map is fast but can be slightly out of date.** A user may click a seat that was just taken, and they will see a "seat unavailable" message. We accept this because the database makes the final decision and the cache saves enormous load.
- **One primary database gives correctness but limits scale.** Writing all seat changes to one place makes double-booking impossible, but that place could become a bottleneck. At our estimated 33 purchases per second this is fine, and if needed we can split events across several databases, because seats never need to be compared across events.
- **SQL over NoSQL.** The data is structured and connected, and we need transactions and constraints to guarantee correctness, which relational databases do very well. A NoSQL store would scale writes more easily but would make the "never sell the same seat twice" guarantee harder to enforce.