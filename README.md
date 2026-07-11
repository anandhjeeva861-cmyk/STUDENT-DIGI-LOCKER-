# Student Digital Locker

A responsive student document portal for secure academic records, teacher account management, and modern campus administration built with HTML5, CSS3, Bootstrap 5, Font Awesome, Vanilla JavaScript, Firebase Authentication, and Firestore.

## Structure

```text
StudentLocker/
|-- index.html
|-- teacher-login.html / teacher-register.html
|-- student-register.html
|-- student-dashboard.html
|-- teacher-dashboard.html
|-- profile.html / teacher-profile.html
|-- personal-documents.html
|-- online-certificates.html
|-- offline-certificates.html
|-- academic-certificates.html
|-- add-student.html / search-student.html
|-- view-document.html
`-- assets/
    |-- css/  (style.css, login.css, dashboard.css, responsive.css, theme.css)
    `-- js/   (app.js, login.js, dashboard.js, validation.js, layout.js, Firebase services)
```

## Features

- Separate student and teacher account flows backed by Firebase Authentication and Firestore
- Teacher registration with generated internal faculty identifiers
- Firestore-backed student, teacher, profile, dashboard, and document data
- Dark / light mode with Local Storage persistence
- Form validation, password strength meter, and show/hide password
- Document upload, preview, view, download, and delete
- Teacher: Add and search students, manage teacher profile

## Run

Run `npm run dev` for local development or `npm run build` for production output.
