# School Database Design

## Tables

### students
Stores one row per student: an `id` (primary key), the student's `name` and their `email`. The email is `UNIQUE` so two students cannot share one address, and both name and email are `NOT NULL`.

### courses
Stores one row per course: an `id` (primary key), the course `title` and the number of `credits`. All three columns are required.

### enrolments
Records the fact that a student is taking a course. Each row has an `id`, a `student_id` (foreign key to `students`), a `course_id` (foreign key to `courses`) and the student's `grade` for that course. A `UNIQUE (student_id, course_id)` rule stops the same student enrolling on the same course twice.

## Relationships

- **One-to-many:** One student can have many enrolments, and one course can have many enrolments, but each enrolment belongs to exactly one student and one course.
- **Many-to-many:** Students and courses are many-to-many. A student takes many courses, and a course has many students.
- **Why a join table is needed:** A relational table cannot hold a list of courses inside one student row, or a list of students inside one course row. The `enrolments` table sits between them and turns one many-to-many relationship into two one-to-many relationships. It also gives the grade a natural home, because a grade belongs to a student and a course together, not to either one alone.

## Index I would add

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
```

**Reason:** The query "all students on one course" and the per-course count both look up enrolments by `course_id`. The `UNIQUE (student_id, course_id)` rule already creates an index that helps searches by student, but it does not help searches that start from the course. An index on `course_id` keeps these queries fast as the number of enrolments grows.

## SQL or NoSQL?

I would choose SQL for this system. School data is highly structured and connected: students, courses and enrolments follow fixed rules, such as unique emails, valid grades and one enrolment per student per course. A relational database enforces those rules with constraints and foreign keys, and joins make it easy to ask questions that cross the tables, such as which students are on a course or who has no enrolments. A NoSQL document database would be more useful for loosely structured data that changes shape often, such as activity logs, but it would push the work of keeping the data consistent onto the application.