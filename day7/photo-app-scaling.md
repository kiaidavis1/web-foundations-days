# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from people they follow. This plan estimates the load and designs a system that can handle it.

## 1. Assumptions

- 10 million registered users
- 10% of them are active each day
- Each active user uploads 1 photo per day
- Each active user views 50 feed pages per day (each view is one request)
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail
- There are 86,400 seconds in a day
- Peak traffic is 5 times the average
- Photos are kept forever
- 1 TB = 1,000,000 MB

## 2. Estimates

**Daily active users**
- 10,000,000 x 10% = 1,000,000 daily active users

**Uploads per second**
- 1,000,000 uploads per day / 86,400 = about 12 uploads per second on average
- Peak: 12 x 5 = about 58 uploads per second

**Feed views per second**
- 1,000,000 users x 50 views = 50,000,000 feed views per day
- 50,000,000 / 86,400 = about 579 feed views per second on average
- Peak: 579 x 5 = about 2,900 feed views per second

**Storage per year**
- Per photo: 2 MB original + 0.05 MB thumbnail = 2.05 MB
- Per day: 1,000,000 x 2.05 MB = 2,050,000 MB = about 2.05 TB
- Per year: 2.05 TB x 365 = about 748 TB (roughly 0.75 PB)
- Originals alone: about 730 TB per year. Thumbnails: about 18 TB per year.
- This is the raw size. Real storage systems keep extra copies for safety, so the actual capacity needed is higher.

## 3. Read-heavy or write-heavy?

The system is **read-heavy**. There are about 579 feed views per second against only 12 uploads per second, so reads outnumber writes by about 50 to 1.

What this means for the design:
- Spend effort making reads fast and cheap: a CDN, a cache and read replicas.
- A single database primary can handle the small number of writes, while reads are spread across replicas.
- Uploads are rare enough that slow work, such as making thumbnails, can happen in the background.

## 4. Why photos should not be stored in the database

- At about 748 TB per year, photos would make the database enormous, slow to back up and expensive to replicate.
- A database is built for small, structured records that are queried and joined, not for large binary files.
- Object storage is cheap, very durable and made to hold huge numbers of files, and a CDN can serve them directly.
- So the database stores only the metadata (owner, caption, time and the storage location of the photo), and the photo files go in object storage.

## 5. Architecture diagram

```
          Users (mobile app / browser)
            |                    |
            | view photos        | API calls (upload, feed)
            v                    v
       +---------+        +----------------+
       |   CDN   |        | Load balancer  |
       +----+----+        +--------+-------+
            |                      |
        cache miss                 v
            |          +----------------------+
            |          | App servers (many)   |
            |          +-----+-----+-----+----+
            |                |     |     |
            |       +--------+     |     +--------+
            |       v              v              v
            |  +---------+   +-----------+   +---------+
            |  |  Cache  |   | Database  |   |  Queue  |
            |  | (feeds) |   | (primary) |   +----+----+
            |  +---------+   +-----+-----+        |
            |                      |              v
            |                      v         +---------+
            |               +-------------+  | Worker  |
            |               | Read replica|  |(thumbs) |
            |               +-------------+  +----+----+
            |                                     |
            v                                     v
       +---------------------------------------------------+
       |  Object storage (original photos + thumbnails)    |
       +---------------------------------------------------+
```

Notes on the diagram:
- App servers save each original photo in object storage and write its details to the database primary.
- The worker reads the original from object storage and saves the thumbnail back there.
- App servers read feeds from the cache first and use the read replica when the cache has no answer.

## 6. Components

- **CDN:** It keeps copies of photos and thumbnails close to users, so images load quickly and the servers are not hit for every picture.
- **Load balancer:** It spreads incoming requests across many app servers so that no single server is overloaded and one failure does not stop the app.
- **App servers:** They run the application logic for uploads, feeds and accounts, and can be added or removed as traffic changes.
- **Cache:** It keeps recently built feeds in fast memory, so the same feed does not have to be rebuilt from the database again and again.
- **Database (primary):** It is the single place where new data is written, which keeps the information about users, photos and follows consistent.
- **Read replica:** It is a copy of the database that answers read queries, taking the heavy reading load off the primary.
- **Object storage:** It stores the huge number of photo files cheaply and safely, which a database cannot do well.
- **Queue:** It holds "make a thumbnail" jobs so the upload request does not have to wait for the slow work to finish.
- **Worker:** It takes jobs from the queue, creates the 50 KB thumbnail and saves it, so thumbnails are made in the background.

## 7. Upload flow, step by step

1. The user picks a photo in the app, which sends an upload request through the load balancer to an app server.
2. The app server checks that the user is logged in and that the file is a valid image of an allowed size.
3. The app server saves the original 2 MB photo in object storage.
4. The app server writes a row to the database primary with the owner, the storage location and a status of "processing".
5. The app server puts a "create thumbnail" job on the queue and immediately tells the user the upload was received.
6. A worker takes the job from the queue, reads the original photo and creates a 50 KB thumbnail.
7. The worker saves the thumbnail in object storage and updates the database row to "ready".
8. When followers open their feed, the app server returns the photo details and the CDN delivers the thumbnails. The full photo is loaded only when someone taps on it.

## 8. Trade-offs

- **Thumbnails are made in the background.** Uploads feel fast because the user does not wait for image processing, and the queue absorbs sudden bursts. The cost is that a thumbnail may appear a few seconds late, and the queue and workers add more parts to run and monitor.
- **Read replicas give fast reads, but the data can be slightly out of date.** Copying data from the primary takes a moment, so a user might not see a brand-new photo straight away. This can be reduced by reading a user's own photos from the primary.
- **Caching speeds up feeds but can show stale data.** A cached feed may miss a new photo until it expires or is refreshed, and deciding when to refresh it adds complexity. A short cache time is a compromise.
- **A CDN and object storage cost money.** At about 748 TB of new photos per year, storage and delivery are major costs, but they are far cheaper than serving every image from the app servers.