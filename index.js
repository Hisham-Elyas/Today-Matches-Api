const exprss = require("express");
const app = exprss();
const morgan = require("morgan");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const today_matchesRoutes = require("./api/routes/today_matches");

// mongoose.connect("mongodb://localhost:27017/rest_api");

mongoose.Promise = global.Promise;
app.use(morgan("dev"));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
    return res.status(200).json({});
  }
  next();
});

app.use("/today_matches", today_matchesRoutes);

app.use((req, res, next) => {
  const response = res.status(200).json({
    message: "welcome to today matches api try /today_matches",
  });
  next(response);
});

app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message,
    },
  });
});
module.exports = app;
