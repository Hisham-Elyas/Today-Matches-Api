const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

const filterMatches = () => {
  const inputFilePath = "matches.json"; // Input file with all matches
  const outputFilePath = "filter_matches.json"; // Filtered matches output file

  try {
    // Read the input JSON file
    const data = fs.readFileSync(inputFilePath, "utf-8");
    const matches = JSON.parse(data);

    // Filter matches
    const filteredMatches = matches.map((match) => {
      // Extract Match Info details
      const matchTime =
        match.details?.matchInfo.find((info) => info.title === "Match Time")
          ?.content || "N/A";
      const matchDate =
        match.details?.matchInfo.find((info) => info.title === "Match Date")
          ?.content || "N/A";

      // Filter and map channels and commentators
      let channelsAndCommentators = [];
      channelsAndCommentators =
        match.details?.matchInfo
          .filter(
            (info) => info.title === "Channel" || info.title === "Commentator"
          )
          .map((info) => {
            if (info.title === "Channel") {
              return { Channel: info.content };
            }
            if (info.title === "Commentator") {
              return { Commentator: info.content };
            }
          }) || [];

      // Fallback to matchInfo if no valid channels or commentators in channelsAndCommentators
      if (!channelsAndCommentators || channelsAndCommentators.length === 0) {
        match.details?.channelsAndCommentators.forEach((entry) => {
          const { channel, commentator } = entry;
          if (channel) {
            channelsAndCommentators.push({ Channel: channel });
          }
          if (commentator) {
            channelsAndCommentators.push({ Commentator: commentator });
          }
        });
      }

      const mergeChannelsAndCommentators = (channelsAndCommentators) => {
        const merged = [];
        for (let i = 0; i < channelsAndCommentators.length; i += 2) {
          const channelObj = channelsAndCommentators[i];
          const commentatorObj = channelsAndCommentators[i + 1];

          if (channelObj?.Channel && commentatorObj?.Commentator) {
            merged.push({
              Channel: channelObj.Channel,
              Commentator: commentatorObj.Commentator,
            });
          }
        }
        return merged.slice(0, 2);
      };
      channelsAndCommentators = mergeChannelsAndCommentators(
        channelsAndCommentators
      );

      // Return the filtered match structure
      return {
        league: match.league,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeTeamLogo: match.homeTeamLogo,
        awayTeamLogo: match.awayTeamLogo,
        // time: match.time,
        matchDate,
        matchTime,
        channelsAndCommentators,
      };
    });

    // Save filtered matches to a new file
    fs.writeFileSync(
      outputFilePath,
      JSON.stringify(filteredMatches, null, 2),
      "utf-8"
    );
    console.log(`Filtered matches saved to ${outputFilePath}`);
  } catch (error) {
    console.error("Error processing matches:", error.message || error);
  }
};

const scrapeTodayMatches = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    await page.goto("https://www.ysscores.com/en/today_matches", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await page.waitForSelector(".matches-wrapper", { timeout: 60000 });

    // Extract matches
    const matches = await page.evaluate(() => {
      const baseURL = "https://www.ysscores.com";
      return (
        Array.from(document.querySelectorAll(".matches-wrapper"))
          // .slice(0, 2)  // for test 2 matches only
          .flatMap((championship) => {
            const leagueName =
              championship
                .querySelector(".champ-title b")
                ?.textContent.trim() || "Unknown League";
            const leagueNameLogo =
              championship.querySelector(".champ-title img")?.src || "No Logo";
            const matchItems = Array.from(
              championship.querySelectorAll(".ajax-match-item")
            );

            return matchItems.map((match) => ({
              matchLink: match.getAttribute("href") || "No Link",
              league: leagueName,
              leagueLogo: leagueNameLogo,
              homeTeam:
                match.querySelector(".first-team b")?.textContent.trim() ||
                "Unknown Team",
              awayTeam:
                match.querySelector(".second-team b")?.textContent.trim() ||
                "Unknown Team",
              awayTeamLogo:
                match.querySelector(".second-team img")?.src || "No Logo",
              homeTeamLogo:
                match.querySelector(".first-team img")?.src || "No Logo",
              time:
                match.querySelector(".match-date")?.textContent.trim() ||
                "Time not available",
            }));
          })
      );
    });

    console.log(
      `Scraped ${matches.length} matches. Starting detailed scraping...`
    );

    for (const match of matches) {
      if (!match.matchLink) {
        console.log(
          `Skipping match with no link: ${match.homeTeam} vs ${match.awayTeam}`
        );
        continue;
      }

      try {
        await page.goto(match.matchLink, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        // Scrape detailed match info
        const matchDetails = await page.evaluate(() => {
          // Extract all key-value pairs from "Match Info"
          const matchInfo = Array.from(
            document.querySelectorAll(".match-info-item")
          ).map((info) => ({
            title: info.querySelector(".title")?.textContent.trim() || "N/A",
            content:
              info.querySelector(".content")?.textContent.trim() || "N/A",
          }));

          // Extract all channels and commentators
          const channelsAndCommentators = Array.from(
            document.querySelectorAll(".match-info-item.sub")
          ).map((item) => ({
            channel:
              item.querySelector(".title")?.textContent.trim() ||
              "Channel not available",
            commentator:
              item.querySelector(".content a")?.textContent.trim() ||
              "Commentator not available",
          }));

          return {
            matchInfo,
            channelsAndCommentators,
          };
        });

        match.details = matchDetails;
      } catch (error) {
        console.error(`Error scraping details for ${match.matchLink}:`, error);
        match.details = { error: "Failed to retrieve details" };
      }
    }

    // console.log("Detailed Matches:");
    // matches.forEach((match) => {
    //   console.log(`Match: ${match.homeTeam} vs ${match.awayTeam}`);
    //   console.log(`League: ${match.league}`);
    //   console.log("Match Info:");
    //   (match.details?.matchInfo || []).forEach((info) =>
    //     console.log(`  ${info.title}: ${info.content}`)
    //   );
    //   console.log("Channels and Commentators:");
    //   (match.details?.channelsAndCommentators || []).forEach((info) => {
    //     console.log(
    //       `  Channel: ${info.channel}, Commentator: ${info.commentator}`
    //     );
    //   });
    //   console.log("====================================");
    // });

    // Save the data to a JSON file
    const filePath = "matches.json";
    fs.writeFileSync(filePath, JSON.stringify(matches, null, 2), "utf-8");
    console.log("Data saved to matches.json");
    // Run the filter function
    filterMatches();
  } catch (error) {
    console.error("Error scraping matches:", error);
  } finally {
    await browser.close();
  }
};

// scrapeTodayMatches();
// filterMatches();
module.exports = scrapeTodayMatches;
