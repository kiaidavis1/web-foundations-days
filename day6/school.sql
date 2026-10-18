PRAGMA foreign_keys = ON;

-- Tables
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  credits INTEGER NOT NULL
);

CREATE TABLE enrolments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  grade INTEGER CHECK (grade BETWEEN 0 AND 100),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE (student_id, course_id)
);

-- Sample data
INSERT INTO students (name, email) VALUES
  ('Amina Wanjiku', 'amina@example.com'),
  ('Brian Otieno', 'brian@example.com'),
  ('Cynthia Njeri', 'cynthia@example.com'),
  ('David Mwangi', 'david@example.com');

INSERT INTO courses (title, credits) VALUES
  ('Mathematics', 4),
  ('English', 3),
  ('Science', 4);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 78),
  (1, 2, 82),
  (2, 1, 65),
  (2, 3, 71),
  (3, 3, 90);

-- Query 1: all courses for one student (by name)
SELECT courses.title, enrolments.grade
FROM students
JOIN enrolments ON students.id = enrolments.student_id
JOIN courses ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Wanjiku';

-- Query 2: all students on one course
SELECT students.name, students.email, enrolments.grade
FROM courses
JOIN enrolments ON courses.id = enrolments.course_id
JOIN students ON students.id = enrolments.student_id
WHERE courses.title = 'Mathematics';

-- Query 3: the number of students per course
SELECT courses.title, COUNT(enrolments.student_id) AS student_count
FROM courses
LEFT JOIN enrolments ON courses.id = enrolments.course_id
GROUP BY courses.id, courses.title;

-- Query 4: students who have no enrolments
SELECT students.name, students.email
FROM students
LEFT JOIN enrolments ON students.id = enrolments.student_id
WHERE enrolments.id IS NULL;

-- Query 5: update one enrolment's grade
UPDATE enrolments
SET grade = 85
WHERE student_id = (SELECT id FROM students WHERE name = 'Brian Otieno')
  AND course_id = (SELECT id FROM courses WHERE title = 'Mathematics');

-- Check the update
SELECT students.name, courses.title, enrolments.grade
FROM enrolments
JOIN students ON students.id = enrolments.student_id
JOIN courses ON courses.id = enrolments.course_id
WHERE students.name = 'Brian Otieno';