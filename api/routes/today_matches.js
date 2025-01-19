const express = require("express");
const router = express.Router();

const todaymatchesContrller = require("../controller/today_matches");
router.get("/", todaymatchesContrller.get_all_matches);

module.exports = router;
