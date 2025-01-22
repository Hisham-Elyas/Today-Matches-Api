const fs = require("fs");

function parseM3UtoJSON(m3uPath, jsonPath) {
  const data = fs.readFileSync(m3uPath, "utf8");
  const lines = data.split("\n");
  const groups = {};

  let currentEntry = null;
  let totalChannels = 0;

  lines.forEach((line) => {
    line = line.trim();
    if (line.startsWith("#EXTINF")) {
      currentEntry = {};

      // Extract attributes using regex
      const attrRegex = /([a-z-]+)="(.*?)"/gi;
      let match;
      while ((match = attrRegex.exec(line)) !== null) {
        currentEntry[match[1]] = match[2];
      }

      // Extract channel name (after last comma)
      const name = line.split(",").pop();
      currentEntry.name = name.trim();
    } else if (line.startsWith("http")) {
      if (currentEntry) {
        currentEntry.url = line;

        // Get or create group
        const groupTitle = currentEntry["group-title"] || "UNGROUPED";
        if (!groups[groupTitle]) {
          groups[groupTitle] = [];
        }

        // Add to group
        groups[groupTitle].push({
          "tvg-id": currentEntry["tvg-id"] || "",
          "tvg-name": currentEntry["tvg-name"] || "",
          "tvg-logo": currentEntry["tvg-logo"] || "",
          name: currentEntry.name,
          url: currentEntry.url,
        });

        totalChannels++; // Increment total channel count
        currentEntry = null;
      }
    }
  });

  // Convert to array format
  const result = Object.keys(groups).map((groupTitle) => ({
    "group-title": groupTitle,
    channels: groups[groupTitle],
  }));

  // Write to JSON file
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 4));
  console.log(`Successfully converted to ${jsonPath}`);

  // Print statistics
  console.log(`\nTotal number of channels: ${totalChannels}`);
  console.log(`Number of groups: ${Object.keys(groups).length}`);
  //   console.log("\nNumber of channels in each group:");
  //   for (const [groupTitle, channels] of Object.entries(groups)) {
  //     console.log(`- ${groupTitle}: ${channels.length} channels`);
  //   }
}

// Usage
parseM3UtoJSON("playlist.m3u", "IP_TV_Playlist.json");
