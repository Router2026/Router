import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pois } from "./schema";
import type { NewPoi } from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// ─────────────────────────────────────────────────────────────────────────────
// Seed v4 — Comprehensive POI expansion across all regions & categories
// Regions: galilee, jerusalem, tel_aviv, negev
// Categories: restaurant, coffee_trail, hiking_trail, attraction, campsite
// ─────────────────────────────────────────────────────────────────────────────

type SeedPoi = Omit<NewPoi, "id" | "createdAt" | "updatedAt">;

const newPois: SeedPoi[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GALILEE — RESTAURANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Fattoush Restaurant Haifa",
    category: "restaurant",
    region: "galilee",
    subRegion: "haifa_carmel",
    description:
      "Beloved Arab-Israeli restaurant in Haifa's German Colony serving mezze, grilled meats, and fresh salads. Perfect spot before exploring the Baha'i Gardens.",
    address: "Ben Gurion Ave 38, Haifa",
    latitude: 32.8149,
    longitude: 34.9895,
    visitDurationMinutes: 75,
    openingHours: "Daily 12:00–23:00",
    isActive: true,
  },
  {
    name: "Douzan Restaurant Haifa",
    category: "restaurant",
    region: "galilee",
    subRegion: "haifa_carmel",
    description:
      "Haifa institution in the German Colony fusing Middle Eastern and Mediterranean flavors. Known for its lamb dishes and homemade baklava.",
    address: "Ben Gurion Ave 35, Haifa",
    latitude: 32.8143,
    longitude: 34.9892,
    visitDurationMinutes: 75,
    openingHours: "Sun–Thu 12:00–23:00, Fri–Sat 12:00–00:00",
    isActive: true,
  },
  {
    name: "El Babor Umm el-Fahm",
    category: "restaurant",
    region: "galilee",
    subRegion: "jezreel_valley",
    description:
      "Legendary Arab restaurant in Umm el-Fahm famed for traditional clay-pot cooking. Whole roasted lamb, fresh taboon bread, and spectacular Carmel views.",
    address: "Main Road, Umm el-Fahm",
    latitude: 32.5163,
    longitude: 35.1523,
    visitDurationMinutes: 90,
    openingHours: "Daily 11:00–22:00",
    isActive: true,
  },
  {
    name: "Mona Restaurant Tzfat",
    category: "restaurant",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "Elegant dairy restaurant in Tzfat's historic quarter serving creative Israeli cuisine. Signature soufflés, local Galilee cheeses, and rooftop views over the valley.",
    address: "Artists' Quarter, Tzfat",
    latitude: 32.9643,
    longitude: 35.4948,
    visitDurationMinutes: 75,
    openingHours: "Sun–Thu 12:00–21:00, Fri 12:00–14:00",
    isActive: true,
  },
  {
    name: "HaEsh BeGalil",
    category: "restaurant",
    region: "galilee",
    subRegion: "lower_galilee",
    description:
      "Rustic wood-fire grill restaurant near Kfar Kana. Whole chicken over open flame, fresh pitas, and Israeli salads in a garden courtyard.",
    address: "Route 754, Kfar Kana",
    latitude: 32.7444,
    longitude: 35.3378,
    visitDurationMinutes: 75,
    openingHours: "Daily 11:00–22:00",
    isActive: true,
  },
  {
    name: "Muscat Winery Restaurant",
    category: "restaurant",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "Farm-to-table winery restaurant at Muscat Winery near Rosh Pina. Seasonal menu pairs with estate wines — lamb, root vegetables, and handmade pasta.",
    address: "Near Rosh Pina, Upper Galilee",
    latitude: 32.9501,
    longitude: 35.5399,
    visitDurationMinutes: 90,
    openingHours: "Fri–Sat 12:00–21:00, Sun 12:00–18:00",
    isActive: true,
  },
  {
    name: "Dag Al HaDan",
    category: "restaurant",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "Legendary fish restaurant on the banks of the Dan River at Kibbutz Dan. Fresh trout from the river, al fresco dining under trees, and the sound of rushing water.",
    address: "Kibbutz Dan, Upper Galilee",
    latitude: 33.2447,
    longitude: 35.6503,
    visitDurationMinutes: 90,
    openingHours: "Daily 10:00–20:00",
    isActive: true,
  },
  {
    name: "Vered HaGalil Guest Farm Restaurant",
    category: "restaurant",
    region: "galilee",
    subRegion: "lower_galilee",
    description:
      "Western-style steakhouse and farm restaurant overlooking the Sea of Galilee. Known for grilled meats and horse-riding farm atmosphere.",
    address: "Vered HaGalil, Route 90, Lower Galilee",
    latitude: 32.8869,
    longitude: 35.5639,
    visitDurationMinutes: 75,
    openingHours: "Daily 12:00–21:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GALILEE — HIKING TRAILS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Nahal Keziv Stream Trail",
    category: "hiking_trail",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "A hidden gem: this Western Galilee stream trail passes Montfort Crusader Castle ruins through lush riverside forest. Crystal pools for summer swimming. Difficulty: Easy–Moderate.",
    address: "Near Kibbutz Eilon, Western Galilee",
    latitude: 33.0592,
    longitude: 35.2193,
    visitDurationMinutes: 180,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Gamla Falls & Vulture Trail",
    category: "hiking_trail",
    region: "galilee",
    subRegion: "golan",
    description:
      "Golan Heights trail to Israel's highest waterfall (51m) passing through an ancient Jewish city. Griffon vultures nest in the cliffs overhead. Difficulty: Moderate.",
    address: "Gamla Nature Reserve, Golan Heights",
    latitude: 32.9022,
    longitude: 35.7536,
    visitDurationMinutes: 180,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },
  {
    name: "Nahal Zavitan Canyon Loop",
    category: "hiking_trail",
    region: "galilee",
    subRegion: "golan",
    description:
      "A dramatic Golan canyon hike with black basalt walls, natural pools, and a challenging rope descent. One of Israel's most thrilling canyoning routes. Difficulty: Hard.",
    address: "Yehudiya Nature Reserve, Golan Heights",
    latitude: 32.9601,
    longitude: 35.7411,
    visitDurationMinutes: 240,
    openingHours: "Daily 08:00–16:00",
    isActive: true,
  },
  {
    name: "Carmel Ridge Trail (Nes Harim to Ein Hod)",
    category: "hiking_trail",
    region: "galilee",
    subRegion: "haifa_carmel",
    description:
      "Scenic ridge trail along the Carmel with Mediterranean scrub, sea views, and passage through the artists' village of Ein Hod. Difficulty: Moderate.",
    address: "Carmel National Park, Haifa",
    latitude: 32.7133,
    longitude: 34.9848,
    visitDurationMinutes: 240,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Wadi Hamam Cliffs Trail",
    category: "hiking_trail",
    region: "galilee",
    subRegion: "lower_galilee",
    description:
      "Short but dramatic hike through the cliffs above Wadi Hamam (Nahal Arbel) with ancient cave dwellings and sweeping Kinneret views. Difficulty: Moderate.",
    address: "Wadi Hamam, Lower Galilee",
    latitude: 32.8129,
    longitude: 35.5015,
    visitDurationMinutes: 150,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Nahal Senir (Hasbani) Trail",
    category: "hiking_trail",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "Riverside walk along one of the Jordan River's headwaters through wild fig, oleander, and cypress. Cool even in summer. Great birdwatching. Difficulty: Easy.",
    address: "Near Tel Dan Nature Reserve, Upper Galilee",
    latitude: 33.2501,
    longitude: 35.6412,
    visitDurationMinutes: 120,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Horns of Hattin Battlefield Trail",
    category: "hiking_trail",
    region: "galilee",
    subRegion: "lower_galilee",
    description:
      "Walk across the extinct volcano crater where Saladin defeated the Crusaders in 1187. Panoramic views over Kinneret, Galilee, and Golan. Difficulty: Easy.",
    address: "Horns of Hattin, Route 77, Lower Galilee",
    latitude: 32.7848,
    longitude: 35.4842,
    visitDurationMinutes: 90,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Beit She'arim Catacombs & Park Trail",
    category: "hiking_trail",
    region: "galilee",
    subRegion: "jezreel_valley",
    description:
      "UNESCO-listed ancient Jewish necropolis with hundreds of carved sarcophagi and underground galleries, combined with a hilltop park trail. Difficulty: Easy.",
    address: "Beit She'arim National Park, Jezreel Valley",
    latitude: 32.7006,
    longitude: 35.1293,
    visitDurationMinutes: 120,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GALILEE — ATTRACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Baha'i Gardens Haifa",
    category: "attraction",
    region: "galilee",
    subRegion: "haifa_carmel",
    description:
      "UNESCO World Heritage Site — 19 terraced gardens cascading down Mount Carmel to the sea. One of the most beautifully designed sacred sites in the world.",
    address: "Yefe Nof St, Haifa",
    latitude: 32.8146,
    longitude: 34.9884,
    visitDurationMinutes: 90,
    openingHours:
      "Daily 09:00–17:00 (lower gardens); upper terrace Fri–Mon 09:00–12:00",
    isActive: true,
  },
  {
    name: "Golan Heights Winery",
    category: "attraction",
    region: "galilee",
    subRegion: "golan",
    description:
      "Israel's most acclaimed winery, pioneering quality viticulture in the volcanic Golan soil. Tours of the cellars and tastings of award-winning Yarden and Gamla wines.",
    address: "Industrial Zone, Katzrin, Golan Heights",
    latitude: 32.9942,
    longitude: 35.6865,
    visitDurationMinutes: 90,
    openingHours: "Sun–Thu 08:00–18:00, Fri 08:00–14:00, Sat 10:00–14:00",
    isActive: true,
  },
  {
    name: "Megiddo National Park",
    category: "attraction",
    region: "galilee",
    subRegion: "jezreel_valley",
    description:
      "UNESCO-listed ancient city of 'Armageddon' with 26 layers of civilizations including Egyptian, Canaanite, and Israelite remains. Fascinating archaeological site.",
    address: "Megiddo National Park, Route 66, Jezreel Valley",
    latitude: 32.5836,
    longitude: 35.1843,
    visitDurationMinutes: 120,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },
  {
    name: "Wadi Ara Olive Press (Beit Hagefen)",
    category: "attraction",
    region: "galilee",
    subRegion: "haifa_carmel",
    description:
      "Ancient Roman-era olive press museum in the Arab-Jewish town of Binyamina area. Traditional olive oil pressing demonstrations and local art exhibitions.",
    address: "Beit HaGefen, Haifa",
    latitude: 32.8074,
    longitude: 35.0003,
    visitDurationMinutes: 60,
    openingHours: "Sun–Thu 09:00–17:00",
    isActive: true,
  },
  {
    name: "Tel Hazor National Park",
    category: "attraction",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "UNESCO-listed largest biblical-era city in Canaan. Excavations reveal Egyptian-period palaces, temples, and an impressive Bronze Age water system.",
    address: "Tel Hazor, Rosh Pina Junction",
    latitude: 33.0178,
    longitude: 35.5682,
    visitDurationMinutes: 90,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },
  {
    name: "Katzrin Ancient Village",
    category: "attraction",
    region: "galilee",
    subRegion: "golan",
    description:
      "Reconstructed Byzantine-era Jewish village in the Golan with authentic stone houses, ancient synagogue, and olive press. Living history experience.",
    address: "Ancient Katzrin Park, Golan Heights",
    latitude: 32.9928,
    longitude: 35.6872,
    visitDurationMinutes: 90,
    openingHours: "Sat–Thu 09:00–17:00, Fri 09:00–14:00",
    isActive: true,
  },
  {
    name: "Montfort Crusader Castle",
    category: "attraction",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "Dramatic Crusader castle ruin atop a forested ridge in the Western Galilee. Accessible only on foot through Nahal Keziv canyon. Spectacular views.",
    address: "Nahal Keziv, Western Galilee",
    latitude: 33.0561,
    longitude: 35.2038,
    visitDurationMinutes: 180,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Druze Hospitality Center Daliyat al-Carmel",
    category: "attraction",
    region: "galilee",
    subRegion: "haifa_carmel",
    description:
      "The heart of Israel's Druze culture. Traditional food, handicrafts, and warm hospitality. Visit the marketplace for knives, rugs, and fresh pita.",
    address: "Main Street, Daliyat al-Carmel",
    latitude: 32.6915,
    longitude: 35.0495,
    visitDurationMinutes: 90,
    openingHours: "Daily 09:00–18:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GALILEE — CAMPSITES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Mevo Hama Campsite, Golan",
    category: "campsite",
    region: "galilee",
    subRegion: "golan",
    description:
      "Hot springs campsite on the southern Golan next to the Yarmouk River. Natural thermal pools, shaded pitches, and a great base for Golan hikes.",
    address: "Kibbutz Mevo Hama, Southern Golan",
    latitude: 32.7044,
    longitude: 35.6615,
    visitDurationMinutes: 480,
    openingHours: "Year-round",
    isActive: true,
  },
  {
    name: "Snir Stream Campsite",
    category: "campsite",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "Shaded riverside campsite at the Snir (Hasbani) nature reserve with cool running water, verdant banks, and perfect summer camping.",
    address: "Snir Nature Reserve, Upper Galilee",
    latitude: 33.2338,
    longitude: 35.6349,
    visitDurationMinutes: 480,
    openingHours: "Apr–Oct daily",
    isActive: true,
  },
  {
    name: "Kfar Blum Kayak Campsite",
    category: "campsite",
    region: "galilee",
    subRegion: "upper_galilee",
    description:
      "Campsite at the famous Kfar Blum kayak resort on the Jordan River. Riverside pitches, kayaking, and a pool — perfect for families.",
    address: "Kibbutz Kfar Blum, Upper Galilee",
    latitude: 33.1793,
    longitude: 35.6109,
    visitDurationMinutes: 480,
    openingHours: "Apr–Oct daily",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JERUSALEM — RESTAURANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Machneyuda Restaurant Jerusalem",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Iconic Jerusalem restaurant by chefs Yossi Elad and Assaf Granit. Energetic atmosphere, market-fresh ingredients, and creative Israeli cuisine. Book well in advance.",
    address: "Beit Ya'akov 10, Jerusalem",
    latitude: 31.7838,
    longitude: 35.2131,
    visitDurationMinutes: 120,
    openingHours: "Mon–Sat 12:30–15:00 and 19:00–23:00",
    isActive: true,
  },
  {
    name: "Azura Jerusalem",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Old-school Sephardic kitchen in Mahane Yehuda Market. Famous slow-cooked lamb, kubeh soup, and traditional Shabbat dishes served daily.",
    address: "HaMa'alot 4, Mahane Yehuda, Jerusalem",
    latitude: 31.7847,
    longitude: 35.2131,
    visitDurationMinutes: 75,
    openingHours: "Mon–Sat 08:00–16:00",
    isActive: true,
  },
  {
    name: "Eucalyptus Jerusalem",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Chef Moshe Basson's biblical cuisine restaurant near Jaffa Gate. Dishes inspired by ancient Jerusalem recipes using herbs mentioned in the Bible and Talmud.",
    address: "Khativat Yerushalayim 14, Jerusalem",
    latitude: 31.7766,
    longitude: 35.2291,
    visitDurationMinutes: 90,
    openingHours: "Mon–Sat 12:00–22:30",
    isActive: true,
  },
  {
    name: "Rooftop Restaurant Mamilla Hotel",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Upscale rooftop restaurant with panoramic views of the Old City walls and Tower of David. Modern Israeli cuisine, grills, and an extensive wine list.",
    address: "1 King Solomon St, Jerusalem",
    latitude: 31.778,
    longitude: 35.2256,
    visitDurationMinutes: 90,
    openingHours: "Daily 12:30–16:00 and 18:30–23:00",
    isActive: true,
  },
  {
    name: "Ishtabach Jerusalem",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Creative Palestinian-inspired restaurant in East Jerusalem. Exquisite maqlouba (upside-down rice), musakhan, and fresh mezze in an elegant setting.",
    address: "Nablus Road 23, East Jerusalem",
    latitude: 31.7872,
    longitude: 35.2311,
    visitDurationMinutes: 75,
    openingHours: "Daily 11:00–22:00",
    isActive: true,
  },
  {
    name: "Te'enim Jerusalem",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Beloved vegetarian restaurant near Mahane Yehuda. Israeli countryside cooking with market vegetables, grain bowls, and heavenly desserts. Very popular with locals.",
    address: "Bezalel 12, Jerusalem",
    latitude: 31.7835,
    longitude: 35.2145,
    visitDurationMinutes: 75,
    openingHours: "Sun–Fri 08:00–22:00",
    isActive: true,
  },
  {
    name: "Chakra Restaurant Jerusalem",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Popular modern Israeli restaurant near the Great Synagogue. Creative salads, fish mains, and Israeli comfort food in an airy contemporary space.",
    address: "King George 41, Jerusalem",
    latitude: 31.7793,
    longitude: 35.2225,
    visitDurationMinutes: 75,
    openingHours: "Daily 12:00–23:00",
    isActive: true,
  },
  {
    name: "Satya Jerusalem",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Farm-to-table Israeli restaurant with organic produce from the Jerusalem Hills. Whole-roasted cauliflower, seasonal tartares, and artisan sourdough.",
    address: "Shlomzion HaMalka 1, Jerusalem",
    latitude: 31.7798,
    longitude: 35.2239,
    visitDurationMinutes: 90,
    openingHours: "Mon–Sat 12:30–23:00",
    isActive: true,
  },
  {
    name: "Abu Shukri Hummus Jerusalem",
    category: "restaurant",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Legendary hummus joint inside the Old City's Muslim Quarter. The gold standard for Jerusalem hummus — warm, creamy, topped with whole chickpeas and good olive oil.",
    address: "Al Wad St 63, Old City, Jerusalem",
    latitude: 31.7809,
    longitude: 35.2316,
    visitDurationMinutes: 45,
    openingHours: "Daily 08:00–15:30",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JERUSALEM — HIKING TRAILS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Jerusalem Ramparts Walk",
    category: "hiking_trail",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Walk atop the 16th-century Ottoman walls surrounding the entire Old City. Unique aerial views into all four quarters, the Temple Mount, and surrounding neighborhoods. Difficulty: Easy.",
    address: "Jaffa Gate, Old City, Jerusalem",
    latitude: 31.7765,
    longitude: 35.2282,
    visitDurationMinutes: 120,
    openingHours: "Sat–Thu 09:00–17:00, Fri 09:00–14:00",
    isActive: true,
  },
  {
    name: "Sataf Spring Trail",
    category: "hiking_trail",
    region: "jerusalem",
    subRegion: "jerusalem_hills",
    description:
      "Beautiful Jerusalem Hills trail to an ancient agricultural spring with terraced fields, wildflowers, and cave dwelling remains. Very family-friendly. Difficulty: Easy.",
    address: "Sataf Nature Reserve, Jerusalem Hills",
    latitude: 31.7696,
    longitude: 35.1288,
    visitDurationMinutes: 120,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Nahal Katlav Canyon",
    category: "hiking_trail",
    region: "jerusalem",
    subRegion: "jerusalem_hills",
    description:
      "Dramatic gorge hike in the Jerusalem Hills with seasonal waterfalls, pools, and towering limestone walls. Popular winter and spring destination. Difficulty: Moderate.",
    address: "Nahal Katlav, Jerusalem Hills",
    latitude: 31.8052,
    longitude: 35.0934,
    visitDurationMinutes: 180,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Ein Gedi Nahal David Trail",
    category: "hiking_trail",
    region: "jerusalem",
    subRegion: "dead_sea",
    description:
      "Lush oasis trail in the Judean Desert along a freshwater stream to David's Waterfall, with ibex and hyrax sightings. One of Israel's most spectacular hikes. Difficulty: Easy–Moderate.",
    address: "Ein Gedi Nature Reserve, Dead Sea",
    latitude: 31.4628,
    longitude: 35.3896,
    visitDurationMinutes: 180,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–15:00",
    isActive: true,
  },
  {
    name: "Nahal Og (Wadi Og) Desert Trail",
    category: "hiking_trail",
    region: "jerusalem",
    subRegion: "judean_desert",
    description:
      "Remote desert canyon in the Judean wilderness leading to the Dead Sea shore. Dry riverbed, fossils, and Bedouin ruins along the way. Difficulty: Moderate.",
    address: "Judean Desert, Route 1 turnoff",
    latitude: 31.7132,
    longitude: 35.3789,
    visitDurationMinutes: 240,
    openingHours: "Always open (best Oct–Apr)",
    isActive: true,
  },
  {
    name: "Jerusalem Forest Trail to Yad Kennedy",
    category: "hiking_trail",
    region: "jerusalem",
    subRegion: "jerusalem_hills",
    description:
      "Peaceful pine forest walk to the Kennedy Memorial with panoramic views over the Jerusalem Hills and the valley toward Tel Aviv. Difficulty: Easy.",
    address: "Jerusalem Forest, Hadassah area",
    latitude: 31.77,
    longitude: 35.12,
    visitDurationMinutes: 90,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Wadi Qelt (Nahal Prat) Gorge",
    category: "hiking_trail",
    region: "jerusalem",
    subRegion: "judean_desert",
    description:
      "One of Israel's most iconic hikes through a dramatic Judean Desert gorge. Ancient aqueducts, the cliff-side St. George's Monastery, and a seasonal stream. Difficulty: Moderate.",
    address: "Nahal Prat Nature Reserve, near Jericho",
    latitude: 31.8395,
    longitude: 35.3901,
    visitDurationMinutes: 300,
    openingHours: "Always open (best Oct–Apr)",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JERUSALEM — ATTRACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Western Wall (Kotel)",
    category: "attraction",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Judaism's holiest accessible site — the remaining outer wall of the Second Temple. Open 24/7 for prayer. Jewish quarter tunnels offer fascinating underground tours.",
    address: "Western Wall Plaza, Old City, Jerusalem",
    latitude: 31.7767,
    longitude: 35.2345,
    visitDurationMinutes: 90,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Church of the Holy Sepulchre",
    category: "attraction",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "The holiest site in Christianity, built over the site of Jesus's crucifixion, burial, and resurrection. One of the world's most visited religious sites.",
    address: "Christian Quarter Rd, Old City, Jerusalem",
    latitude: 31.7785,
    longitude: 35.2296,
    visitDurationMinutes: 90,
    openingHours: "Daily 05:00–21:00",
    isActive: true,
  },
  {
    name: "Yad Vashem Holocaust Memorial",
    category: "attraction",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Israel's official memorial to the 6 million Jewish victims of the Holocaust. One of the world's most powerful and important museums. Deeply moving experience.",
    address: "Har HaZikaron, Jerusalem",
    latitude: 31.7743,
    longitude: 35.1761,
    visitDurationMinutes: 180,
    openingHours: "Sun–Wed 09:00–17:00, Thu 09:00–20:00, Fri 09:00–14:00",
    isActive: true,
  },
  {
    name: "Mahane Yehuda Market",
    category: "attraction",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Jerusalem's famous open-air market — a feast of colors, aromas, and tastes. Hundreds of stalls selling spices, halva, fresh produce, and street food. Buzzing day and night.",
    address: "Jaffa Rd, Jerusalem",
    latitude: 31.7851,
    longitude: 35.2128,
    visitDurationMinutes: 90,
    openingHours: "Sun–Thu 08:00–20:00, Fri 08:00–15:00",
    isActive: true,
  },
  {
    name: "Masada National Park",
    category: "attraction",
    region: "jerusalem",
    subRegion: "dead_sea",
    description:
      "Herod's desert fortress atop an isolated mesa where 960 Jewish Zealots made their last stand in 73 CE. UNESCO site with cable car, synagogue, and sunrise hike.",
    address: "Masada National Park, Dead Sea",
    latitude: 31.3155,
    longitude: 35.3535,
    visitDurationMinutes: 240,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },
  {
    name: "Dead Sea Beach Ein Bokek",
    category: "attraction",
    region: "jerusalem",
    subRegion: "dead_sea",
    description:
      "Float effortlessly in the saltiest body of water on earth (431m below sea level). Public beach with changing rooms, fresh water showers, and rich healing mud.",
    address: "Ein Bokek Beach, Dead Sea",
    latitude: 31.2021,
    longitude: 35.3593,
    visitDurationMinutes: 150,
    openingHours: "Always open (beach); facilities 08:00–18:00",
    isActive: true,
  },
  {
    name: "Israel Museum Jerusalem",
    category: "attraction",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Israel's largest cultural institution. Home to the Dead Sea Scrolls in the Shrine of the Book, an outdoor scale model of ancient Jerusalem, and world-class art collections.",
    address: "Ruppin Blvd 11, Jerusalem",
    latitude: 31.773,
    longitude: 35.2037,
    visitDurationMinutes: 180,
    openingHours: "Mon–Wed, Sat 10:00–17:00; Thu 10:00–21:00; Fri 10:00–14:00",
    isActive: true,
  },
  {
    name: "Tower of David Museum",
    category: "attraction",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "3,000 years of Jerusalem history inside the Ottoman citadel by Jaffa Gate. Immersive night spectacle 'Night Spectacular' projected onto ancient walls.",
    address: "Jaffa Gate, Old City, Jerusalem",
    latitude: 31.7762,
    longitude: 35.2279,
    visitDurationMinutes: 120,
    openingHours: "Sat–Thu 09:00–17:00, Fri 09:00–14:00",
    isActive: true,
  },
  {
    name: "Hezekiah's Tunnel (City of David)",
    category: "attraction",
    region: "jerusalem",
    subRegion: "jerusalem_city",
    description:
      "Wade through an 8th-century BCE tunnel carved by King Hezekiah to secure Jerusalem's water supply. A unique underground adventure through 2,700 years of history.",
    address: "City of David, Silwan, Jerusalem",
    latitude: 31.774,
    longitude: 35.236,
    visitDurationMinutes: 120,
    openingHours: "Sun–Thu 08:00–18:00, Fri 08:00–15:00",
    isActive: true,
  },
  {
    name: "Qumran National Park",
    category: "attraction",
    region: "jerusalem",
    subRegion: "judean_desert",
    description:
      "Site where the Dead Sea Scrolls were discovered in 1947. Ancient Essene settlement with archaeological excavations and stunning desert cliffs backdrop.",
    address: "Qumran National Park, near Dead Sea",
    latitude: 31.742,
    longitude: 35.4617,
    visitDurationMinutes: 90,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },
  {
    name: "Ein Gedi Kibbutz Botanical Garden",
    category: "attraction",
    region: "jerusalem",
    subRegion: "dead_sea",
    description:
      "One of the most unusual botanical gardens in the world — tropical and desert plants thriving at the lowest point on earth. Over 900 plant species from 5 continents.",
    address: "Kibbutz Ein Gedi, Dead Sea",
    latitude: 31.4578,
    longitude: 35.3818,
    visitDurationMinutes: 90,
    openingHours: "Sat–Thu 08:00–16:00, Fri 08:00–14:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JERUSALEM — CAMPSITES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Ein Gedi Campsite & Field School",
    category: "campsite",
    region: "jerusalem",
    subRegion: "dead_sea",
    description:
      "Campsite at the Ein Gedi field school, steps from the nature reserve. Desert camping with access to one of Israel's most spectacular oasis hikes.",
    address: "Ein Gedi Field School, Dead Sea",
    latitude: 31.4618,
    longitude: 35.3872,
    visitDurationMinutes: 480,
    openingHours: "Year-round",
    isActive: true,
  },
  {
    name: "Maale Adumim Desert Campsite",
    category: "campsite",
    region: "jerusalem",
    subRegion: "judean_desert",
    description:
      "Rugged desert campsite in the Judean Hills east of Jerusalem. Stargazing, silence, and Bedouin-style fire circles in a raw desert landscape.",
    address: "Judean Desert, near Maale Adumim",
    latitude: 31.7769,
    longitude: 35.2938,
    visitDurationMinutes: 480,
    openingHours: "Year-round",
    isActive: true,
  },
  {
    name: "Biankini Beach Campsite, Dead Sea",
    category: "campsite",
    region: "jerusalem",
    subRegion: "dead_sea",
    description:
      "Popular Dead Sea campsite with direct beach access. Swim in the saltiest water on earth, enjoy mineral mud, and camp under a vast desert sky.",
    address: "Northern Dead Sea Shore, Israel",
    latitude: 31.7103,
    longitude: 35.4519,
    visitDurationMinutes: 480,
    openingHours: "Mar–Oct: daily",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEL AVIV — RESTAURANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Miznon Tel Aviv",
    category: "restaurant",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Legendary pita restaurant by chef Eyal Shani. Creative fillings — whole roasted cauliflower, steak, and market vegetables crammed into soft pita. Lines go around the block.",
    address: "King George 30, Tel Aviv",
    latitude: 32.0713,
    longitude: 34.7766,
    visitDurationMinutes: 45,
    openingHours: "Sun–Thu 11:00–23:00, Fri 11:00–16:00, Sat 19:00–23:00",
    isActive: true,
  },
  {
    name: "Bicicleta Tel Aviv",
    category: "restaurant",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Vibrant tapas bar on Rothschild Boulevard serving outstanding Spanish-Israeli small plates and natural wines. Buzzing outdoor terrace.",
    address: "Rothschild Blvd 140, Tel Aviv",
    latitude: 32.0614,
    longitude: 34.7748,
    visitDurationMinutes: 90,
    openingHours: "Mon–Sat 12:00–00:00",
    isActive: true,
  },
  {
    name: "HaKosem Tel Aviv",
    category: "restaurant",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Famed falafel spot off Dizengoff Square. Crispy on the outside, soft inside — served in fresh pita with a dozen salads. A Tel Aviv institution since 1967.",
    address: "Shlomo HaMelech 1, Tel Aviv",
    latitude: 32.076,
    longitude: 34.7748,
    visitDurationMinutes: 30,
    openingHours: "Sun–Thu 11:00–21:00, Fri 11:00–15:00",
    isActive: true,
  },
  {
    name: "Taizu Tel Aviv",
    category: "restaurant",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Award-winning Asian-fusion restaurant in Tel Aviv. Chef Moshe Segev blends Israeli, Chinese, and Vietnamese influences with locally sourced ingredients.",
    address: "Menachem Begin 23, Tel Aviv",
    latitude: 32.071,
    longitude: 34.7795,
    visitDurationMinutes: 120,
    openingHours: "Mon–Sat 12:00–15:00 and 18:30–23:00",
    isActive: true,
  },
  {
    name: "Shila Restaurant Tel Aviv",
    category: "restaurant",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Beloved seafood restaurant on Gordon Street. Israeli-Mediterranean fish dishes, raw bar, and a consistently superb wine selection.",
    address: "Gordon 182, Tel Aviv",
    latitude: 32.0811,
    longitude: 34.766,
    visitDurationMinutes: 90,
    openingHours: "Mon–Sat 12:30–23:00",
    isActive: true,
  },
  {
    name: "M25 Meat Restaurant Tel Aviv",
    category: "restaurant",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Carnivore's paradise at the Carmel Market. Dry-aged steaks, offal cuts, and house-made sausages in a bold industrial setting. One of Israel's top meat restaurants.",
    address: "Hacarmel Market area, Tel Aviv",
    latitude: 32.0658,
    longitude: 34.7673,
    visitDurationMinutes: 90,
    openingHours: "Mon–Sat 12:00–23:00",
    isActive: true,
  },
  {
    name: "Orna and Ella Tel Aviv",
    category: "restaurant",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Iconic Sheinkin Street brunch and lunch spot. Creative salads, homemade pastas, and irresistible desserts. The original pioneer of Tel Aviv café culture.",
    address: "Sheinkin 33, Tel Aviv",
    latitude: 32.0652,
    longitude: 34.7723,
    visitDurationMinutes: 75,
    openingHours: "Sun–Fri 09:00–18:00, Sat 10:00–18:00",
    isActive: true,
  },
  {
    name: "Jaffa Restaurant (Abu Hassan)",
    category: "restaurant",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Legendary Old Jaffa hummus restaurant, operating since 1958. Widely regarded as Israel's finest hummus. Arrive early — it sells out and closes by 2pm.",
    address: "HaDolfin 1, Old Jaffa",
    latitude: 32.0541,
    longitude: 34.7518,
    visitDurationMinutes: 30,
    openingHours: "Mon–Sat 07:30–14:30 (or until sold out)",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEL AVIV — COFFEE TRAILS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Haj Kahil Jaffa",
    category: "coffee_trail",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Old Jaffa institution serving thick spiced Arabic coffee in a 200-year-old stone courtyard. Dates, cardamom, and a timeless atmosphere in the flea market area.",
    address: "Old Jaffa Flea Market, Jaffa",
    latitude: 32.0548,
    longitude: 34.7527,
    visitDurationMinutes: 45,
    openingHours: "Daily 08:00–18:00",
    isActive: true,
  },
  {
    name: "Cafelix Tel Aviv",
    category: "coffee_trail",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Tel Aviv's specialty coffee pioneer on Balfour Street. Third-wave espresso, precise pour-overs, and rotating single-origin beans. The gold standard of Tel Aviv coffee.",
    address: "Balfour 36, Tel Aviv",
    latitude: 32.0702,
    longitude: 34.775,
    visitDurationMinutes: 45,
    openingHours: "Mon–Fri 07:30–18:00, Sat 09:00–18:00",
    isActive: true,
  },
  {
    name: "Café Tamar Tel Aviv",
    category: "coffee_trail",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Legendary 1950s café on Sheinkin Street — a fixture of Tel Aviv's intellectual bohemian scene. Simple coffee, strong espresso, and conversations that never end.",
    address: "Sheinkin 34, Tel Aviv",
    latitude: 32.0649,
    longitude: 34.7721,
    visitDurationMinutes: 60,
    openingHours: "Daily 07:00–22:00",
    isActive: true,
  },
  {
    name: "Levinsky Market Spice Café",
    category: "coffee_trail",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Standing-room coffee kiosk in the heart of Levinsky Market. Sip specialty espresso among spice merchants, dried fruits, and the scent of za'atar.",
    address: "Levinsky Market, Florentin, Tel Aviv",
    latitude: 32.0601,
    longitude: 34.7619,
    visitDurationMinutes: 30,
    openingHours: "Mon–Fri 07:00–17:00, Sat 07:00–14:00",
    isActive: true,
  },
  {
    name: "Coffee Bar Florentin",
    category: "coffee_trail",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Gritty-cool specialty coffee shop in Tel Aviv's hipster Florentin neighborhood. Single-origins, craft filters, and a laid-back vibe beloved by creatives.",
    address: "Florentin St 32, Tel Aviv",
    latitude: 32.0569,
    longitude: 34.7643,
    visitDurationMinutes: 45,
    openingHours: "Mon–Fri 07:30–18:00, Sat 09:00–16:00",
    isActive: true,
  },
  {
    name: "Varda's Coffee Kiosk Herzliya",
    category: "coffee_trail",
    region: "tel_aviv",
    subRegion: "dan_region",
    description:
      "Beloved boardwalk coffee kiosk in Herzliya Marina. Specialty coffee with a sea breeze and Mediterranean sunrise. A favorite of local surfers and swimmers.",
    address: "Herzliya Marina Boardwalk, Herzliya",
    latitude: 32.1662,
    longitude: 34.8063,
    visitDurationMinutes: 30,
    openingHours: "Daily 06:30–14:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEL AVIV — HIKING TRAILS & OUTDOOR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Yarkon Park Loop Trail",
    category: "hiking_trail",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Green urban trail along the Yarkon River through Tel Aviv's largest park. Rowboats, bike paths, and the Eretz Israel Museum nearby. Perfect morning walk. Difficulty: Easy.",
    address: "Yarkon Park, Tel Aviv",
    latitude: 32.1002,
    longitude: 34.8002,
    visitDurationMinutes: 90,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Apollonia National Park Coastal Trail",
    category: "hiking_trail",
    region: "tel_aviv",
    subRegion: "sharon",
    description:
      "Cliff-edge walk to the ruins of a Crusader fortress dramatically perched above the sea in Herzliya. Dramatic coastal views and good birdwatching in spring. Difficulty: Easy.",
    address: "Apollonia National Park, Herzliya",
    latitude: 32.1767,
    longitude: 34.8004,
    visitDurationMinutes: 90,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },
  {
    name: "Caesarea Ancient Harbor Walk",
    category: "hiking_trail",
    region: "tel_aviv",
    subRegion: "sharon",
    description:
      "Coastal trail through Herod's magnificent ancient harbor city. Roman hippodrome, Byzantine mosaics, Crusader walls, and swimming in the ancient port. Difficulty: Easy.",
    address: "Caesarea National Park, Caesarea",
    latitude: 32.4989,
    longitude: 34.8991,
    visitDurationMinutes: 150,
    openingHours: "Sat–Thu 08:00–18:00, Fri 08:00–17:00",
    isActive: true,
  },
  {
    name: "Sharon HaYarkon Trail (Israel National Trail section)",
    category: "hiking_trail",
    region: "tel_aviv",
    subRegion: "sharon",
    description:
      "A gorgeous section of the Israel National Trail through citrus groves, sand dunes, and the Yarkon River headwaters near Rosh HaAyin. Difficulty: Easy.",
    address: "Mekorot HaYarkon, Rosh HaAyin",
    latitude: 32.0942,
    longitude: 34.9501,
    visitDurationMinutes: 180,
    openingHours: "Always open",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEL AVIV — ATTRACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Old Jaffa (Yafo)",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "One of the world's oldest port cities. Winding stone alleyways, the artists' colony, stunning sea views, and a vibrant flea market. The ancient heart of Tel Aviv.",
    address: "Old Jaffa, Tel Aviv-Yafo",
    latitude: 32.0555,
    longitude: 34.752,
    visitDurationMinutes: 120,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Tel Aviv Port (Namal Tel Aviv)",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Renovated waterfront promenade with boutique market, restaurants, beach clubs, and weekend farmers' market. The trendiest outdoor space in Tel Aviv.",
    address: "Namal Tel Aviv, Tel Aviv Port",
    latitude: 32.0984,
    longitude: 34.7756,
    visitDurationMinutes: 90,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Bauhaus White City Walking Tour",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "UNESCO World Heritage Site — the largest concentration of International Style (Bauhaus) buildings in the world. Self-guided walk through 4,000 buildings from the 1930s.",
    address: "Dizengoff Square area, Tel Aviv",
    latitude: 32.0766,
    longitude: 34.774,
    visitDurationMinutes: 120,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Carmel Market (Shuk HaCarmel)",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Tel Aviv's most famous open-air market. Over 500 stalls selling spices, fresh produce, street food, and clothing. Vibrant, chaotic, and absolutely essential.",
    address: "HaCarmel St, Tel Aviv",
    latitude: 32.0656,
    longitude: 34.7677,
    visitDurationMinutes: 90,
    openingHours: "Sun–Thu 07:00–20:00, Fri 07:00–15:00",
    isActive: true,
  },
  {
    name: "Caesarea Roman Amphitheater",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "sharon",
    description:
      "2,000-year-old Roman amphitheater still used for concerts today — one of the most magical outdoor venues in the world. Visit the ruins of Herod's spectacular harbor city.",
    address: "Caesarea National Park, Caesarea",
    latitude: 32.4971,
    longitude: 34.8989,
    visitDurationMinutes: 120,
    openingHours: "Sat–Thu 08:00–18:00, Fri 08:00–17:00",
    isActive: true,
  },
  {
    name: "Independence Hall Tel Aviv",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Where David Ben-Gurion declared Israel's independence on May 14, 1948. Intimate museum with original furniture and the original microphone preserved exactly as they were.",
    address: "Rothschild Blvd 16, Tel Aviv",
    latitude: 32.0617,
    longitude: 34.7717,
    visitDurationMinutes: 60,
    openingHours: "Sun–Thu 09:00–17:00, Fri 09:00–14:00",
    isActive: true,
  },
  {
    name: "Eretz Israel Museum",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Sprawling museum complex housing ten pavilions covering archaeology, ethnography, glass-blowing, coins, and a planetarium. Built around a genuine archaeological site.",
    address: "Chaim Levanon 2, Tel Aviv",
    latitude: 32.1015,
    longitude: 34.8004,
    visitDurationMinutes: 120,
    openingHours: "Mon–Wed, Sat 10:00–16:00; Thu 10:00–20:00; Fri 10:00–14:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEL AVIV — CAMPSITES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Dor Beach Campsite",
    category: "campsite",
    region: "tel_aviv",
    subRegion: "sharon",
    description:
      "Beautiful Mediterranean coastal campsite at Dor Beach with calm lagoons, snorkeling, and a national park. One of Israel's most scenic beach camping spots.",
    address: "Dor Beach, Hof HaCarmel",
    latitude: 32.6131,
    longitude: 34.9193,
    visitDurationMinutes: 480,
    openingHours: "Apr–Oct: daily",
    isActive: true,
  },
  {
    name: "Nitzanim Nature Reserve Campsite",
    category: "campsite",
    region: "tel_aviv",
    subRegion: "shephelah",
    description:
      "Sand-dune campsite on the Mediterranean coast near Ashkelon with sea turtles nesting on the beach. Rare coastal wilderness close to the central coast.",
    address: "Nitzanim Nature Reserve, South Coast",
    latitude: 31.7301,
    longitude: 34.6393,
    visitDurationMinutes: 480,
    openingHours: "Apr–Oct: daily",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEGEV — RESTAURANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Rota Restaurant Beer Sheva",
    category: "restaurant",
    region: "negev",
    subRegion: "beer_sheva",
    description:
      "Contemporary Israeli restaurant in Beer Sheva's Old City. Creative seasonal menus drawing on Negev herbs and Bedouin flavors. Good wine list.",
    address: "Hameyasdim St 5, Old City Beer Sheva",
    latitude: 31.2476,
    longitude: 34.7922,
    visitDurationMinutes: 90,
    openingHours: "Mon–Sat 12:00–23:00",
    isActive: true,
  },
  {
    name: "Khan Bar Mitzpe Ramon",
    category: "restaurant",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Desert restaurant inside a caravanserai stone courtyard in Mitzpe Ramon. Slow-cooked Negev lamb, root vegetables, and craft beers from the desert.",
    address: "Ein Saharonim, Mitzpe Ramon",
    latitude: 30.5951,
    longitude: 34.8003,
    visitDurationMinutes: 90,
    openingHours: "Daily 12:00–22:00",
    isActive: true,
  },
  {
    name: "Barakiya Bedouin Restaurant",
    category: "restaurant",
    region: "negev",
    subRegion: "beer_sheva",
    description:
      "Authentic Bedouin hospitality in a goat-hair tent near Be'er Sheva. Traditional mansaf, stuffed lamb, fresh taboon bread baked on coals, and sweet tea.",
    address: "Near Tel Sheva, Beer Sheva region",
    latitude: 31.261,
    longitude: 34.8492,
    visitDurationMinutes: 120,
    openingHours: "Daily 10:00–21:00 (by reservation)",
    isActive: true,
  },
  {
    name: "Desert Shade Restaurant Eilat",
    category: "restaurant",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "Eilat's best waterfront dining on the Red Sea lagoon. Grilled fish, Red Sea prawn, and sushi with coral reef views. Romantic sunset dinners.",
    address: "North Beach Promenade, Eilat",
    latitude: 29.5625,
    longitude: 34.9498,
    visitDurationMinutes: 90,
    openingHours: "Daily 12:00–00:00",
    isActive: true,
  },
  {
    name: "HaKeves Restaurant Mitzpe Ramon",
    category: "restaurant",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Desert lamb specialist in Mitzpe Ramon. Whole roasted lamb and Negev mezze served on the rim of the Makhtesh Ramon crater. Breathtaking views.",
    address: "Near the Makhtesh Rim, Mitzpe Ramon",
    latitude: 30.6101,
    longitude: 34.8059,
    visitDurationMinutes: 90,
    openingHours: "Fri–Sat 12:00–21:00, Sun–Thu by reservation",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEGEV — COFFEE TRAILS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Desert Roast Mitzpe Ramon",
    category: "coffee_trail",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Specialty coffee roastery on the edge of the Makhtesh Ramon. Single-origin beans roasted in the desert, served with a view into the ancient crater.",
    address: "Nahal HaMakhtesh 1, Mitzpe Ramon",
    latitude: 30.6085,
    longitude: 34.8012,
    visitDurationMinutes: 45,
    openingHours: "Daily 08:00–17:00",
    isActive: true,
  },
  {
    name: "קפה בוקר — שדה בוקר",
    category: "coffee_trail",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "קפה ספיישלטי על קצה מצוק בן גוריון שבשדה בוקר. נוף פנורמי אל ואדי צין ומדבר יהודה. מקום שבן גוריון עצמו היה אוהב.",
    address: "שדה בוקר, נגב",
    latitude: 30.8756,
    longitude: 34.798,
    visitDurationMinutes: 45,
    openingHours: "ג'–ו' 08:00–15:00, שבת 09:00–16:00",
    isActive: true,
  },
  {
    name: "Espresso Caravan Arava Highway",
    category: "coffee_trail",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "A lone espresso caravan on the Arava Highway between the Dead Sea and Eilat. Specialty coffee in absolute desert silence — one of the most surreal coffee experiences in Israel.",
    address: "Route 90, Arava Desert",
    latitude: 30.3902,
    longitude: 35.1703,
    visitDurationMinutes: 30,
    openingHours: "Daily 06:30–14:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEGEV — HIKING TRAILS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Makhtesh Ramon Crater Rim Trail",
    category: "hiking_trail",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Dramatic hike along the rim of the world's largest erosion crater (40km long). Multicolored rock formations, ancient seabed fossils, and infinite desert silence. Difficulty: Moderate.",
    address: "Mitzpe Ramon Visitor Center, Mitzpe Ramon",
    latitude: 30.6048,
    longitude: 34.8013,
    visitDurationMinutes: 240,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Nahal Tzin Canyon Trail",
    category: "hiking_trail",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Epic desert canyon hike through one of the Negev's most dramatic gorges. Springs, Bedouin ruins, and a seasonal waterfall deep in the wilderness. Difficulty: Hard.",
    address: "Nahal Tzin, Negev Highlands",
    latitude: 30.6882,
    longitude: 34.9003,
    visitDurationMinutes: 480,
    openingHours: "Always open (best Oct–Apr)",
    isActive: true,
  },
  {
    name: "Red Canyon Trail Eilat",
    category: "hiking_trail",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "Short but spectacular canyon hike through fire-red sandstone formations near Eilat. Scrambling, squeezing through slots, and brilliant color. Difficulty: Moderate.",
    address: "Red Canyon, Route 12, near Eilat",
    latitude: 29.7543,
    longitude: 34.8891,
    visitDurationMinutes: 120,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Coral Beach Nature Reserve Eilat",
    category: "hiking_trail",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "Snorkeling trail over a 1km living coral reef in the Red Sea. Hundreds of fish species in crystal-clear water — Israel's premier snorkeling destination. Difficulty: Easy.",
    address: "Coral Beach Reserve, Eilat",
    latitude: 29.5118,
    longitude: 34.9122,
    visitDurationMinutes: 150,
    openingHours: "Sat–Thu 09:00–17:00, Fri 09:00–16:00",
    isActive: true,
  },
  {
    name: "Timna Park Ancient Copper Mines Trail",
    category: "hiking_trail",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "Hike through 6,000 years of copper mining history in a lunar landscape of sandstone arches, ancient Egyptian carvings, and King Solomon's Pillars. Difficulty: Easy–Moderate.",
    address: "Timna National Park, Arava",
    latitude: 29.7904,
    longitude: 34.9782,
    visitDurationMinutes: 240,
    openingHours: "Daily 08:00–17:00",
    isActive: true,
  },
  {
    name: "Nahal Ardon Trail Makhtesh Ramon",
    category: "hiking_trail",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Descent into the Makhtesh Ramon crater floor along Nahal Ardon. Multicolored geological layers, fossilized dinosaur footprints, and ancient volcanic flows. Difficulty: Moderate.",
    address: "Makhtesh Ramon, Negev",
    latitude: 30.5759,
    longitude: 34.7892,
    visitDurationMinutes: 240,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Ben Gurion's Grave Trail, Sde Boker",
    category: "hiking_trail",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Short trail from Ben Gurion's desert home to his grave on the edge of the Tzin Canyon. Stunning panorama and a moment of quiet reflection in the Negev.",
    address: "Sde Boker, Negev",
    latitude: 30.8734,
    longitude: 34.796,
    visitDurationMinutes: 90,
    openingHours: "Always open",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEGEV — ATTRACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Makhtesh Ramon Visitor Center",
    category: "attraction",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Architecturally striking visitor center cantilevered over the world's largest erosion crater. Interactive geology exhibits and the best viewpoint of the 40km Makhtesh Ramon.",
    address: "Mitzpe Ramon, Negev",
    latitude: 30.6072,
    longitude: 34.8006,
    visitDurationMinutes: 60,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },
  {
    name: "Timna Park — King Solomon's Pillars",
    category: "attraction",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "Towering sandstone columns rising 50m from the desert floor. Ancient Egyptian rock carvings, a Hathor temple, and a lake reflection make this utterly otherworldly.",
    address: "Timna National Park, Arava",
    latitude: 29.7912,
    longitude: 34.9801,
    visitDurationMinutes: 120,
    openingHours: "Daily 08:00–17:00",
    isActive: true,
  },
  {
    name: "Underwater Observatory Marine Park Eilat",
    category: "attraction",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "Unique underwater observatory descending 6m below the Red Sea surface. Sharks, rays, and 1,000 species of fish observed through panoramic windows without getting wet.",
    address: "Coral Beach, Eilat",
    latitude: 29.5077,
    longitude: 34.9143,
    visitDurationMinutes: 120,
    openingHours: "Daily 08:30–17:00",
    isActive: true,
  },
  {
    name: "Avdat National Park (Nabataean City)",
    category: "attraction",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "UNESCO-listed Nabataean city on the Incense Route. Beautifully preserved Roman baths, Byzantine churches, and wine presses on a hilltop plateau. Breathtaking desert views.",
    address: "Avdat, Route 40, Negev",
    latitude: 30.7929,
    longitude: 34.7731,
    visitDurationMinutes: 120,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },
  {
    name: "Sde Boker Ben Gurion Campus",
    category: "attraction",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "David Ben-Gurion's desert home and final resting place in a kibbutz he chose to prove the Negev could bloom. His simple hut is preserved exactly as he left it.",
    address: "Midreshet Ben-Gurion, Sde Boker",
    latitude: 30.8781,
    longitude: 34.7965,
    visitDurationMinutes: 90,
    openingHours: "Sun–Thu 08:30–16:30, Fri 08:30–14:00, Sat 10:00–16:00",
    isActive: true,
  },
  {
    name: "Ramon Crater Stargazing Observatory",
    category: "attraction",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "International Dark Sky Reserve — one of the best stargazing spots in the Middle East. Nightly guided telescope sessions with 6,000 stars visible to the naked eye.",
    address: "Mitzpe Ramon, Negev",
    latitude: 30.6102,
    longitude: 34.8035,
    visitDurationMinutes: 120,
    openingHours: "Nightly sessions (pre-booking required)",
    isActive: true,
  },
  {
    name: "Negev Camel Ranch",
    category: "attraction",
    region: "negev",
    subRegion: "beer_sheva",
    description:
      "Family-run camel ranch near Beer Sheva offering 1–3 hour camel treks into the Negev desert, traditional Bedouin tea, and night camping under the stars.",
    address: "Rahat, Negev",
    latitude: 31.3921,
    longitude: 34.7541,
    visitDurationMinutes: 180,
    openingHours: "Daily 09:00–17:00 (treks must be booked)",
    isActive: true,
  },
  {
    name: "Tel Beer Sheva National Park",
    category: "attraction",
    region: "negev",
    subRegion: "beer_sheva",
    description:
      "UNESCO-listed biblical city of Beer Sheva with an impressive Iron Age water cistern, street grid, and the famous four-horned altar. Excellent archaeological museum.",
    address: "Tel Beer Sheva, Beer Sheva",
    latitude: 31.2426,
    longitude: 34.8374,
    visitDurationMinutes: 90,
    openingHours: "Sat–Thu 08:00–17:00, Fri 08:00–16:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEGEV — CAMPSITES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Makhtesh Ramon Desert Camp",
    category: "campsite",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Glamping and wilderness camping inside the Ramon Crater. Wake up surrounded by colored sandstone walls, fossil-filled desert, and skies with zero light pollution.",
    address: "Inside Makhtesh Ramon, Negev",
    latitude: 30.5802,
    longitude: 34.8101,
    visitDurationMinutes: 480,
    openingHours: "Year-round",
    isActive: true,
  },
  {
    name: "Timna Lake Campsite",
    category: "campsite",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "Campsite on an artificial lake inside Timna National Park surrounded by red cliffs. Pedal boats, evening light shows on the sandstone pillars, and Milky Way skies.",
    address: "Timna National Park, Arava",
    latitude: 29.7871,
    longitude: 34.9812,
    visitDurationMinutes: 480,
    openingHours: "Year-round",
    isActive: true,
  },
  {
    name: "Nahal Tzin Wilderness Camp",
    category: "campsite",
    region: "negev",
    subRegion: "mitzpe_ramon",
    description:
      "Wild desert camping in the UNESCO-listed Nahal Tzin canyon. No facilities — pure desert wilderness with ancient springs and total silence. Permit required.",
    address: "Nahal Tzin, Negev Highlands",
    latitude: 30.6923,
    longitude: 34.8901,
    visitDurationMinutes: 480,
    openingHours: "Oct–Apr (dry season)",
    isActive: true,
  },
  {
    name: "Eilat Field School Campsite",
    category: "campsite",
    region: "negev",
    subRegion: "arava_eilat",
    description:
      "SPNI field school campsite near Eilat's coral beach. Great base for Red Sea snorkeling, bird migration watching (500 million birds pass annually), and Arava desert hikes.",
    address: "SPNI Field School, Eilat",
    latitude: 29.5441,
    longitude: 34.9318,
    visitDurationMinutes: 480,
    openingHours: "Year-round",
    isActive: true,
  },
  {
    name: "Har HaNegev Ibex Camp",
    category: "campsite",
    region: "negev",
    subRegion: "beer_sheva",
    description:
      "Remote highland camping spot in the Negev mountains where Nubian ibex roam freely. Basic facilities, fire pits, and a profound sense of desert solitude.",
    address: "Negev Highlands, near Yeruham",
    latitude: 30.9831,
    longitude: 34.9201,
    visitDurationMinutes: 480,
    openingHours: "Year-round",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JERUSALEM HILLS — COFFEE TRAILS (extra)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "עגלת הכפר — מבשרת ציון",
    category: "coffee_trail",
    region: "jerusalem",
    subRegion: "jerusalem_hills",
    description:
      "עגלת קפה חמה במבשרת ציון, שער הרי ירושלים. קפה ספיישלטי עם נוף לעמק המצלבה ולירושלים. עצירה מושלמת בדרך ירושלים–תל אביב.",
    address: "מרכז מבשרת ציון",
    latitude: 31.81,
    longitude: 35.155,
    visitDurationMinutes: 30,
    openingHours: "א'–ו' 07:00–15:00",
    isActive: true,
  },
  {
    name: "קפה הגבעה — עמינדב",
    category: "coffee_trail",
    region: "jerusalem",
    subRegion: "jerusalem_hills",
    description:
      "עגלת קפה בוטיק בכפר עמינדב שבהרי ירושלים. קפה ספיישלטי עם נוף עמוק לצנחייה ולשפלה. מקום שהזמן עוצר בו.",
    address: "עמינדב, הרי ירושלים",
    latitude: 31.755,
    longitude: 35.05,
    visitDurationMinutes: 30,
    openingHours: "ו'–שבת 08:30–14:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GALILEE EXTRA — RESTAURANTS (Druze, Arab, and mixed cuisine)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Al-Reda Nazareth",
    category: "restaurant",
    region: "galilee",
    subRegion: "lower_galilee",
    description:
      "Elegant Arab restaurant in a restored Ottoman mansion in old Nazareth. Refined Palestinian cuisine — mansaf, warak dawali, and muqadam — in stunning surroundings.",
    address: "Old City, Nazareth",
    latitude: 32.702,
    longitude: 35.2973,
    visitDurationMinutes: 90,
    openingHours: "Daily 10:00–23:00",
    isActive: true,
  },
  {
    name: "Diana Restaurant Nazareth",
    category: "restaurant",
    region: "galilee",
    subRegion: "lower_galilee",
    description:
      "Nazareth's iconic Arab grill restaurant. Open-fire meats, local mezze, and a warm terrace in the lower city. Family-run since 1962.",
    address: "Paul VI St, Nazareth",
    latitude: 32.7024,
    longitude: 35.2985,
    visitDurationMinutes: 75,
    openingHours: "Daily 11:00–22:00",
    isActive: true,
  },
  {
    name: "Focaccia Bar Haifa",
    category: "restaurant",
    region: "galilee",
    subRegion: "haifa_carmel",
    description:
      "Haifa institution on the Carmel serving gourmet focaccia topped with seasonal vegetables, fish, and cheeses. Casual, charming, and consistently excellent.",
    address: "HaNamal 24, Haifa",
    latitude: 32.8203,
    longitude: 35.0006,
    visitDurationMinutes: 75,
    openingHours: "Sun–Thu 12:00–23:00, Fri–Sat 12:00–00:00",
    isActive: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEL AVIV AREA — EXTRA ATTRACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Palmach Museum Tel Aviv",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Immersive underground museum narrating the Palmach pre-state fighters through theater, film, and reconstructed environments. One of Israel's most powerful museums.",
    address: "HaChaim 10, Tel Aviv",
    latitude: 32.1001,
    longitude: 34.7943,
    visitDurationMinutes: 120,
    openingHours: "Sun–Thu 09:00–15:30 (must book a tour)",
    isActive: true,
  },
  {
    name: "Rabin Square Tel Aviv",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "tel_aviv_city",
    description:
      "Tel Aviv's central public square where Prime Minister Yitzhak Rabin was assassinated in 1995. A memorial and the city's main gathering place for concerts and demonstrations.",
    address: "Rabin Square, Tel Aviv",
    latitude: 32.0809,
    longitude: 34.7807,
    visitDurationMinutes: 30,
    openingHours: "Always open",
    isActive: true,
  },
  {
    name: "Tel Megiddo Lookout (Carmel viewpoint)",
    category: "attraction",
    region: "tel_aviv",
    subRegion: "sharon",
    description:
      "Panoramic viewpoint from the Carmel ridge over the entire Jezreel Valley — often called the breadbasket of Israel. Sunrise and sunset are spectacular.",
    address: "Carmel Ridgeline, Route 70",
    latitude: 32.6091,
    longitude: 35.0612,
    visitDurationMinutes: 45,
    openingHours: "Always open",
    isActive: true,
  },
];

async function seedV4() {
  console.log(`\nSeeding ${newPois.length} POIs...`);

  let inserted = 0;
  let skipped = 0;

  for (const poi of newPois) {
    try {
      await db.insert(pois).values(poi).onConflictDoNothing();
      inserted++;
      process.stdout.write(".");
    } catch {
      skipped++;
      process.stdout.write("x");
    }
  }

  console.log(`\n\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);

  const byCategory: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  for (const p of newPois) {
    byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    byRegion[p.region] = (byRegion[p.region] ?? 0) + 1;
  }

  console.log("\nBy category:");
  for (const [c, n] of Object.entries(byCategory)) console.log(`  ${c}: ${n}`);
  console.log("\nBy region:");
  for (const [r, n] of Object.entries(byRegion)) console.log(`  ${r}: ${n}`);
}

seedV4().catch((err) => {
  console.error("Seed v4 failed:", err);
  process.exit(1);
});
