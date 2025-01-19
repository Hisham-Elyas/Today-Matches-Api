le.exports = mongoose.model("Hospital", hospitalSchema);

const mongoose = require("mongoose");
const matchSchema = new mongoose.Schema({
  league: { type: String },
  homeTeam: { type: String },
  awayTeam: { type: String },
  homeTeamLogo: { type: String },
  awayTeamLogo: { type: String },
  matchDate: { type: String },
  matchTime: { type: String },
  channelsAndCommentators: [
    {
      Channel: { type: String },
      Commentator: { type: String },
    },
  ],
});

module.exports = mongoose.model("Match", matchSchema);
