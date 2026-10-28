// INTENTIONALLY VULNERABLE - for Semgrep demo only
const express = require("express");
const { exec } = require("child_process");
const mysql = require("mysql");

const app = express();
const db = mysql.createConnection({ host: "localhost", user: "root", password: "root123" });

app.get("/user", (req, res) => {
  // SQL injection
  db.query("SELECT * FROM users WHERE id = " + req.query.id, (err, rows) => res.json(rows));
});

app.get("/ping", (req, res) => {
  // Command injection
  exec("ping -c 1 " + req.query.host, (err, out) => res.send(out));
});

app.get("/hello", (req, res) => {
  // Reflected XSS
  res.send("<h1>Hello " + req.query.name + "</h1>");
});

app.get("/calc", (req, res) => {
  // Code injection
  res.send(String(eval(req.query.expr)));
});

app.get("/redirect", (req, res) => {
  // Open redirect
  res.redirect(req.query.url);
});

app.listen(3000);
