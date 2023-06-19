const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const app = express();

// Set up MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'cdb'
});

// Set up session middleware
app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
  })
);

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Set up body parser middleware
app.use(express.urlencoded({ extended: false }));

// Define routes
app.get('/', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // Implement email and password validation against the database
  connection.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    (error, results) => {
      if (error) throw error;

      if (results.length === 1) {
        const user = results[0];

        if (user.blocked_until && user.blocked_until > new Date()) {
          // User is blocked
          const timeUntilUnblock = Math.ceil((user.blocked_until - new Date()) / (1000 * 60 * 60)); // Calculate remaining blocked time in hours
          res.render('login', {
            error: `User is blocked. Please try again after ${timeUntilUnblock} hours.`
          });
          return;
        }

        if (user.password === password) {
          // If the user login is successful
          req.session.user = {
            email: user.email
          };
          res.redirect('/home');
        } else {
          // If the login fails
          const attempts = user.login_attempts + 1;
          const blockedUntil =
            attempts === 5 ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

          connection.query(
            'UPDATE users SET login_attempts = ?, blocked_until = ? WHERE id = ?',
            [attempts, blockedUntil, user.id],
            (error) => {
              if (error) throw error;

              if (attempts === 5) {
                res.render('login', {
                  error:
                    'Invalid email or password. User is blocked for 24 hours.'
                });
              } else {
                res.render('login', {
                  error: 'Invalid email or password.'
                });
              }
            }
          );
        }
      } else {
        // If the login fails
        res.render('login', { error: 'Invalid email or password.' });
      }
    }
  );
});

app.get('/home', (req, res) => {
  const user = req.session.user;
  if (user) {
    res.render('home', { user: user });
  } else {
    res.redirect('/');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});