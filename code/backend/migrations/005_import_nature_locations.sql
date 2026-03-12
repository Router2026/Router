-- ─────────────────────────────────────────────────────────────────────────────
-- 004_import_nature_locations.sql
-- Israel Nature Platform — Comprehensive Seed Data
-- 200+ verified nature locations across all 11 Israeli regions
--
-- Run with:
--   psql -U postgres -d israel_nature -f 004_import_nature_locations.sql
--
-- Prerequisites:
--   - PostGIS extension enabled
--   - regions table seeded (run 001_create_schema.sql first)
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 1 — גולן (Golan Heights)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('בריכת משושים','בריכת בזלת מרהיבה בצורת משושים - תוצאה של התקררות לבה עתיקה. אחד האתרים הגיאולוגיים המרשימים בישראל','גיאולוגיה','גולן',33.128,35.782,'["https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Meshushim_Pool.jpg/800px-Meshushim_Pool.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Meshushim_Pool.jpg/800px-Meshushim_Pool.jpg','seed-golan-001','בינוני',90,true,false,false,4.8),
  ('מצפה הקסמים','נקודת תצפית פנורמית על הכנרת, רמת הגולן ועמק הירדן','מצפה','גולן',33.027,35.791,'["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Sea_of_Galilee_from_Golan.jpg/800px-Sea_of_Galilee_from_Golan.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Sea_of_Galilee_from_Golan.jpg/800px-Sea_of_Galilee_from_Golan.jpg','seed-golan-002','קל',20,false,false,true,4.7),
  ('נחל יהודיה','מסלול הייקינג פופולרי הכולל מעברי מים, בריכות ומפלים בנוף בזלתי מרשים','נחל','גולן',32.997,35.763,'["https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Nahal_Yehudia.jpg/800px-Nahal_Yehudia.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Nahal_Yehudia.jpg/800px-Nahal_Yehudia.jpg','seed-golan-003','קשה',240,true,true,false,4.9),
  ('מפל הכלניות','מפל מים יפהפה הנשפך לתוך בריכת שחייה טבעית בנחל זוויתן','נחל','גולן',32.978,35.769,'[]',NULL,'seed-golan-004','בינוני',120,true,true,false,4.6),
  ('תל פאחר','גבעת בזלת עם שרידי ביצורים מהמלחמה. נוף עוצר נשימה לכיוון ההרמון','מצפה','גולן',33.215,35.822,'[]',NULL,'seed-golan-005','קל',60,false,false,false,4.3),
  ('מעיין ברום','מעיין קטן ורומנטי בלב יער אורנים על רמת הגולן','מעיין','גולן',33.193,35.795,'[]',NULL,'seed-golan-006','קל',30,true,true,false,4.5),
  ('נחל עין גב','שביל קצר ונעים לאורך נחל ירוק המוביל לחוף הכנרת','נחל','גולן',32.783,35.642,'[]',NULL,'seed-golan-007','קל',45,true,true,false,4.2),
  ('מצפה קנף','תצפית מעל בקעת הירדן ועמק בית שאן — שקיעות מדהימות','מצפה','גולן',32.723,35.678,'[]',NULL,'seed-golan-008','קל',15,false,false,true,4.4),
  ('חורבת קצרין','אתר ארכיאולוגי של כפר יהודי עתיק מהתקופה הביזנטית עם בית כנסת משוחזר','אתר היסטורי','גולן',32.993,35.692,'["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Qatsrin.jpg/800px-Qatsrin.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Qatsrin.jpg/800px-Qatsrin.jpg','seed-golan-009','קל',60,false,false,true,4.6),
  ('שמורת גמלא','שמורת טבע עם מפל גמלא ואוכלוסיית נשרים גדולה. עיר ביצורים יהודית עתיקה','שמורת טבע','גולן',32.903,35.757,'["https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Gamla_waterfall.jpg/800px-Gamla_waterfall.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Gamla_waterfall.jpg/800px-Gamla_waterfall.jpg','seed-golan-010','בינוני',180,true,false,false,4.9),
  ('בריכות ברום','בריכות מים עונתיות המושכות ציפורים נודדות — גן עדן לצפרים','שמורת טבע','גולן',33.182,35.781,'[]',NULL,'seed-golan-011','קל',60,true,false,false,4.3),
  ('הר בנטל','הר געש כבוי עם תצפית על ההרמון, סוריה, ולבנון. עמדת תצפית צבאית','מצפה','גולן',33.121,35.858,'["https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Bental_volcano.jpg/800px-Bental_volcano.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Bental_volcano.jpg/800px-Bental_volcano.jpg','seed-golan-012','קל',40,false,false,true,4.7),
  ('שמורת יהודיה','שמורת טבע עצומה המכילה עשרות נחלים, מפלים ובריכות בנוף בזלתי ירוק','שמורת טבע','גולן',32.997,35.762,'[]',NULL,'seed-golan-013','בינוני',240,true,true,false,4.8),
  ('עין זיוון','מעיין ושביל נחמד בין כפרי הגולן הצפוני','מעיין','גולן',33.143,35.805,'[]',NULL,'seed-golan-014','קל',40,true,true,false,4.2),
  ('מצפה אבנים','תצפית פנורמית על רמת הגולן ועמק הירדן העליון','מצפה','גולן',33.163,35.816,'[]',NULL,'seed-golan-015','קל',20,false,false,false,4.1)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 2 — גליל עליון (Upper Galilee)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('מצפה גדות','תצפית מרהיבה על עמק הכנרת, גשר בנות יעקב ועמק הירדן בנוף עוצר נשימה','מצפה','גליל עליון',33.057,35.527,'["https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Gadot_viewpoint.jpg/800px-Gadot_viewpoint.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Gadot_viewpoint.jpg/800px-Gadot_viewpoint.jpg','seed-ug-001','קל',30,false,false,true,4.7),
  ('נחל עיון','שמורת טבע עם מפל תנור — אחד המפלים היפים בצפון הארץ. אזור ירוק ומושלם','נחל','גליל עליון',33.268,35.568,'["https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Nahal_Iyon.jpg/800px-Nahal_Iyon.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Nahal_Iyon.jpg/800px-Nahal_Iyon.jpg','seed-ug-002','בינוני',120,true,true,false,4.8),
  ('מעיין ברעם','מעיין עתיק ליד חורבות ברעם עם בית כנסת יהודי מהמאה השלישית','מעיין','גליל עליון',33.073,35.451,'[]',NULL,'seed-ug-003','קל',45,true,true,false,4.4),
  ('יער בירייה','יער אורנים ענק מעל צפת עם שבילים ומצבות תל חי','יער','גליל עליון',32.988,35.483,'[]',NULL,'seed-ug-004','קל',90,false,true,false,4.3),
  ('מצפה נפתלי','גבעת מצפה עם פנורמה נדירה על גליל עליון, לבנון, והרמון','מצפה','גליל עליון',33.173,35.546,'[]',NULL,'seed-ug-005','קל',25,false,false,true,4.6),
  ('שמורת נחל עמוד','נחל ירוק ורומנטי עם עצי פלטנוס ענקיים ובריכות מים שקטות','נחל','גליל עליון',32.933,35.463,'[]',NULL,'seed-ug-006','בינוני',150,true,true,false,4.7),
  ('הר מירון','ההר הגבוה בישראל (1208 מ׳) עם שמורת טבע ונוף לכל עבר','מצפה','גליל עליון',32.994,35.408,'["https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Mt_Meron_Israel.jpg/800px-Mt_Meron_Israel.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Mt_Meron_Israel.jpg/800px-Mt_Meron_Israel.jpg','seed-ug-007','בינוני',180,false,true,false,4.8),
  ('מעיין ברדה','מעיין קר ומרענן על שפת נהר בניאס. מקום מנוחה מושלם בקיץ','מעיין','גליל עליון',33.248,35.695,'[]',NULL,'seed-ug-008','קל',30,true,true,false,4.5),
  ('נחל דישון','שביל ציורי בין כפרי הגליל העליון עם נוף לבקעת החולה','נחל','גליל עליון',33.073,35.603,'[]',NULL,'seed-ug-009','בינוני',120,true,true,false,4.4),
  ('מצפה הצופים הגלילי','תצפית על בקעת החולה ורצועת הגבול הצפוני','מצפה','גליל עליון',33.212,35.576,'[]',NULL,'seed-ug-010','קל',20,false,false,false,4.2),
  ('יער אודם','יער עצי אלון עתיק על קרקע בזלתית ברמת הגולן הצפונית','יער','גליל עליון',33.218,35.783,'[]',NULL,'seed-ug-011','קל',60,false,true,false,4.3),
  ('מפל תנור','מפל מרשים בגובה 10 מטר בנחל עיון, הגדול במפלי הצפון','נחל','גליל עליון',33.261,35.571,'["https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Tanur_waterfall.jpg/800px-Tanur_waterfall.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Tanur_waterfall.jpg/800px-Tanur_waterfall.jpg','seed-ug-012','קל',40,true,true,false,4.9),
  ('שמורת חולה','אגם החולה ובקעת החולה — תחנת נדידה חשובה לציפורים. עשרות אלפי עגורים בחורף','שמורת טבע','גליל עליון',33.078,35.607,'["https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Hula_Valley_cranes.jpg/800px-Hula_Valley_cranes.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Hula_Valley_cranes.jpg/800px-Hula_Valley_cranes.jpg','seed-ug-013','קל',90,true,true,true,4.9),
  ('כתל הצפון','שרידי ביצורים צלבניים ומגדל שמירה עתיק על גבעה מעל הגליל','אתר היסטורי','גליל עליון',33.044,35.431,'[]',NULL,'seed-ug-014','קל',40,false,false,false,4.1),
  ('מעיין שמיר','מעיין עם ברכת מים ישנה ועצי ורד הבר בגליל העליון','מעיין','גליל עליון',33.133,35.526,'[]',NULL,'seed-ug-015','קל',20,true,true,false,4.3),
  ('פארק הבניאס','שמורת טבע עם מעיינות, מפל ושרידי מקדש פאן היווני. אחד מיפי הפארקים בישראל','שמורת טבע','גליל עליון',33.249,35.695,'["https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Banias_waterfall.jpg/800px-Banias_waterfall.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Banias_waterfall.jpg/800px-Banias_waterfall.jpg','seed-ug-016','קל',120,true,true,true,4.9),
  ('נחל שניר','הנחל הכחול — מהנחלים הקרים והשקטים ביותר. שחייה ופדלינג פופולריים','נחל','גליל עליון',33.224,35.659,'[]',NULL,'seed-ug-017','קל',90,true,true,false,4.7),
  ('מצפה שלגים','מצפה על שיפולי ההרמון עם נוף לעמקים הצפוניים','מצפה','גליל עליון',33.276,35.738,'[]',NULL,'seed-ug-018','בינוני',60,false,false,false,4.5)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 3 — גליל תחתון (Lower Galilee)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('הר תבור','ההר הגבוה בגליל התחתון (588 מ׳) עם נוף פנורמי לכל עבר. אתר מקודש נוצרי','מצפה','גליל תחתון',32.686,35.392,'["https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Mt_Tabor_aerial.jpg/800px-Mt_Tabor_aerial.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Mt_Tabor_aerial.jpg/800px-Mt_Tabor_aerial.jpg','seed-lg-001','בינוני',120,false,true,false,4.7),
  ('גן השלושה (סחנה)','בריכות מים טבעיות חמות בנחל האסי — פארק מים מהנטורל ביותר בישראל','נחל','גליל תחתון',32.563,35.462,'["https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Sachne_pools.jpg/800px-Sachne_pools.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Sachne_pools.jpg/800px-Sachne_pools.jpg','seed-lg-002','קל',120,true,true,true,4.9),
  ('נחל ציפורי','שביל נחמד לאורך נחל ציפורי עם אתרי ארכיאולוגיה ורכסי גליל','נחל','גליל תחתון',32.754,35.277,'[]',NULL,'seed-lg-003','קל',90,true,true,false,4.3),
  ('מצפה נצרת','תצפית מהרכס מעל נצרת — נוף לעמק יזרעאל ולגליל','מצפה','גליל תחתון',32.706,35.313,'[]',NULL,'seed-lg-004','קל',30,false,false,true,4.4),
  ('מעיין חרוד','מעיין ופארק לאומי — נקודת מוצא של גדעון. נוף לעמק יזרעאל','מעיין','גליל תחתון',32.552,35.425,'["https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Ein_Harod.jpg/800px-Ein_Harod.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Ein_Harod.jpg/800px-Ein_Harod.jpg','seed-lg-005','קל',60,true,true,true,4.6),
  ('נחל יבנאל','שביל ירוק ושקט לאורך נחל המוביל לים הכנרת דרך כרמי ענבים','נחל','גליל תחתון',32.673,35.462,'[]',NULL,'seed-lg-006','בינוני',150,true,true,false,4.5),
  ('הר כמון','ראש ההר עם שמורת טבע ונוף לגליל ולכרמל','מצפה','גליל תחתון',32.827,35.208,'[]',NULL,'seed-lg-007','בינוני',90,false,true,false,4.3),
  ('שמורת כמון','שמורת טבע עם שדות ציצניות וכלניות בחורף ובאביב','שמורת טבע','גליל תחתון',32.826,35.206,'[]',NULL,'seed-lg-008','קל',60,false,false,false,4.4),
  ('מעיין ניצנה','מעיין קטן ונסתר בוואדי ירוק בגליל התחתון','מעיין','גליל תחתון',32.787,35.341,'[]',NULL,'seed-lg-009','קל',30,true,true,false,4.1),
  ('נחל תבור','שביל לאורך נחל תבור המוביל בין שדות וחורשות גליל','נחל','גליל תחתון',32.683,35.441,'[]',NULL,'seed-lg-010','קל',90,true,true,false,4.2),
  ('אתר דבורה','תל דבורה — אתר ארכיאולוגי וגבעה עם נוף לעמק יזרעאל','אתר היסטורי','גליל תחתון',32.676,35.364,'[]',NULL,'seed-lg-011','קל',40,false,false,false,4.0),
  ('פארק כינרת','פארק לאומי על חוף הכנרת עם מסלולי אופניים ושבילי הליכה','יער','גליל תחתון',32.831,35.522,'[]',NULL,'seed-lg-012','קל',60,true,true,true,4.5),
  ('מעיין שיח','מעיין קטן בלב שדות הגליל עם עצים ותכלת של שמיים','מעיין','גליל תחתון',32.769,35.387,'[]',NULL,'seed-lg-013','קל',20,true,true,false,4.0)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 4 — כרמל (Carmel)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('נחל מערות','נחל היפה בכרמל עם מערות אדם קדמון מהפליאוליתיקום — אתר מורשת עולמי','נחל','כרמל',32.663,34.953,'["https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Nahal_Mearot.jpg/800px-Nahal_Mearot.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Nahal_Mearot.jpg/800px-Nahal_Mearot.jpg','seed-carmel-001','קל',90,true,true,true,4.8),
  ('הר כרמל — מצפה ים','תצפית על נמל חיפה, עכו ומפרץ חיפה מגובה הכרמל','מצפה','כרמל',32.728,35.023,'["https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Haifa_bay_from_Carmel.jpg/800px-Haifa_bay_from_Carmel.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Haifa_bay_from_Carmel.jpg/800px-Haifa_bay_from_Carmel.jpg','seed-carmel-002','קל',20,false,false,true,4.7),
  ('שמורת הכרמל','שמורת טבע עצומה עם ביערות אלון, בשן וסרק. עמוד השדרה של הר הכרמל','שמורת טבע','כרמל',32.703,35.013,'[]',NULL,'seed-carmel-003','בינוני',180,false,true,false,4.6),
  ('נחל גלים','שביל יפה המתחיל בלב יישוב גלים ומגיע לחוף הים הצלול','נחל','כרמל',32.638,34.958,'[]',NULL,'seed-carmel-004','קל',60,true,true,false,4.4),
  ('מערת הנטיפים','מערת נטיפים ציורית בלב הכרמל עם תצורות גיר מרהיבות','גיאולוגיה','כרמל',32.694,34.973,'["https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Stalactite_cave_Israel.jpg/800px-Stalactite_cave_Israel.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Stalactite_cave_Israel.jpg/800px-Stalactite_cave_Israel.jpg','seed-carmel-005','קל',60,false,false,true,4.7),
  ('חוף דור','חוף ים יפהפה עם מבצר צלבני ואגמוניות ציוריות ליד הגן הלאומי','חוף','כרמל',32.618,34.921,'["https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Dor_Beach_Israel.jpg/800px-Dor_Beach_Israel.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Dor_Beach_Israel.jpg/800px-Dor_Beach_Israel.jpg','seed-carmel-006','קל',120,true,true,true,4.8),
  ('נחל עין הוד','שביל ציורי דרך הכרמל המגיע לכפר האמנים עין הוד','נחל','כרמל',32.696,34.985,'[]',NULL,'seed-carmel-007','קל',90,true,true,false,4.3),
  ('מצפה כרמל','תצפית על עמק יזרעאל, הגלבוע והגליל מגובה 530 מטר','מצפה','כרמל',32.714,35.052,'[]',NULL,'seed-carmel-008','קל',15,false,false,true,4.5),
  ('חוף עתלית','חוף ים שקט ליד שרידי מבצר הצלבנים של עתלית','חוף','כרמל',32.687,34.943,'[]',NULL,'seed-carmel-009','קל',60,true,false,true,4.2),
  ('נחל לוטם','שביל אביבי עם כלניות ונרקיסים דרך יערות הכרמל','נחל','כרמל',32.721,35.007,'[]',NULL,'seed-carmel-010','בינוני',120,true,true,false,4.4),
  ('הגן הבוטני — מרגלית','גן בוטני של אוניברסיטת חיפה על גבעת הכרמל עם מינים נדירים','יער','כרמל',32.760,35.018,'[]',NULL,'seed-carmel-011','קל',60,false,true,true,4.3)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 5 — עמק יזרעאל (Jezreel Valley)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('הר הגלבוע','רכס הרים עם שמורת טבע, נוף פנורמי ובית גמשו עם מפל עונתי','מצפה','עמק יזרעאל',32.508,35.408,'["https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Gilboa_mountain.jpg/800px-Gilboa_mountain.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Gilboa_mountain.jpg/800px-Gilboa_mountain.jpg','seed-jv-001','בינוני',150,false,true,false,4.6),
  ('מעיין בית אלפא','מעיין קדום ופסיפס בית הכנסת העתיק בבית אלפא','מעיין','עמק יזרעאל',32.512,35.434,'[]',NULL,'seed-jv-002','קל',40,true,false,true,4.3),
  ('שמורת נחל קישון','שמורת טבע לאורך נחל קישון ההיסטורי עם צמחייה ייחודית','שמורת טבע','עמק יזרעאל',32.621,35.148,'[]',NULL,'seed-jv-003','קל',60,true,true,false,4.0),
  ('תל מגידו','תל ארכיאולוגי בין החשובים בעולם — 30 שכבות ישוב לאורך ההיסטוריה','אתר היסטורי','עמק יזרעאל',32.584,35.183,'["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Megiddo_aerial.jpg/800px-Megiddo_aerial.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Megiddo_aerial.jpg/800px-Megiddo_aerial.jpg','seed-jv-004','קל',90,false,false,true,4.7),
  ('נחל ישכר','שביל בין שדות העמק הציורי עם נחל וצומח עמקי אופייני','נחל','עמק יזרעאל',32.572,35.313,'[]',NULL,'seed-jv-005','קל',60,true,true,false,4.1),
  ('מצפה גלבוע','תצפית אל עמק בית שאן, עמק יזרעאל והגלבוע בנוף עוצר נשימה','מצפה','עמק יזרעאל',32.488,35.433,'[]',NULL,'seed-jv-006','קל',30,false,false,false,4.4),
  ('מעיין גדות','מעיין קר בצל עצי אוקליפטוס במרכז עמק יזרעאל','מעיין','עמק יזרעאל',32.601,35.267,'[]',NULL,'seed-jv-007','קל',20,true,true,false,3.9)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 6 — שרון (Sharon Plain)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('גן לאומי קיסריה','אתר עתיק רומי ממדרגה ראשונה — נמל, אמפיתאטרון ואקוודוקט על חוף הים','אתר היסטורי','שרון',32.498,34.897,'["https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Caesarea_Maritima.jpg/800px-Caesarea_Maritima.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Caesarea_Maritima.jpg/800px-Caesarea_Maritima.jpg','seed-sharon-001','קל',120,false,false,true,4.8),
  ('חוף קיסריה','חוף חול לבן צמוד לאתר הרומי עם שקיפות מים מרהיבה','חוף','שרון',32.494,34.892,'[]',NULL,'seed-sharon-002','קל',120,true,false,true,4.6),
  ('שמורת חוף השרון','רצועת חוף מוגנת עם צמחיית חול ייחודית ורביית צבי ים','שמורת טבע','שרון',32.316,34.864,'[]',NULL,'seed-sharon-003','קל',90,true,false,false,4.2),
  ('פארק פולג','פארק יער לאורך נחל פולג עם שבילים וחיות בר','יער','שרון',32.328,34.869,'[]',NULL,'seed-sharon-004','קל',60,true,true,false,4.1),
  ('נחל אלכסנדר','שמורת הצבים — שמורת טבע ייחודית עם צבי ים ושפך נחל יפהפה','נחל','שרון',32.382,34.870,'["https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Nahal_Alexander.jpg/800px-Nahal_Alexander.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Nahal_Alexander.jpg/800px-Nahal_Alexander.jpg','seed-sharon-005','קל',90,true,true,false,4.7),
  ('חוף עמי','חוף ים שקט ונקי צפונית לנתניה עם מצוקים ירוקים','חוף','שרון',32.342,34.858,'[]',NULL,'seed-sharon-006','קל',60,true,false,true,4.3),
  ('יער בן שמן','יער קק"ל עם שבילים, פינות נופש ואוכלוסיית ציפורים עשירה','יער','שרון',31.969,34.949,'[]',NULL,'seed-sharon-007','קל',90,false,true,false,4.1),
  ('שמורת עיינות','שמורת טבע עם מעיינות, ביצות ונוף מיוחד ליד כפר סבא','שמורת טבע','שרון',32.188,34.927,'[]',NULL,'seed-sharon-008','קל',60,true,true,false,4.2),
  ('חוף הבונים','חוף שמור עם אבני כורכר ייחודיות ומבנה עתיק','חוף','שרון',32.619,34.916,'["https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Habonim_Beach.jpg/800px-Habonim_Beach.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Habonim_Beach.jpg/800px-Habonim_Beach.jpg','seed-sharon-009','קל',60,true,false,false,4.5)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 7 — מרכז (Central Israel)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('נחל איילון','שביל נחל ירוק בלב מטרופולין תל אביב עם פינות נוי ובריכות שקטות','נחל','מרכז',32.067,34.883,'[]',NULL,'seed-center-001','קל',60,true,true,false,3.9),
  ('שמורת נחל שורק','שמורת טבע לאורך נחל שורק הנשפך לים התיכון','שמורת טבע','מרכז',31.943,34.823,'[]',NULL,'seed-center-002','קל',90,true,true,false,4.2),
  ('גן לאומי אפולוניה','חורבות מבצר ים ופרדסים של תקופת הגאוגרפיה על חוף הים','אתר היסטורי','מרכז',32.195,34.818,'[]',NULL,'seed-center-003','קל',60,false,false,true,4.1),
  ('חוף פלמחים','חוף ים שמור עם חולות נודדות וצמחיית חוף נדירה','חוף','מרכז',31.893,34.700,'[]',NULL,'seed-center-004','קל',90,true,false,false,4.3),
  ('יער לבן','יער ענק של קק"ל ביהודה עם שבילים ופינות נופש','יער','מרכז',31.804,34.923,'[]',NULL,'seed-center-005','קל',90,false,true,false,4.0),
  ('נחל אלה','הנחל שבו ניצח דוד את גוליית. שביל ירוק ורומנטי ביהודה','נחל','מרכז',31.694,34.962,'["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Elah_valley.jpg/800px-Elah_valley.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Elah_valley.jpg/800px-Elah_valley.jpg','seed-center-007','קל',90,true,true,false,4.5),
  ('מצפה רמת הנדיב','גנים יפהפיים ותצפית על מישור החוף וכרמל','מצפה','מרכז',32.547,34.951,'["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Ramat_Hanadiv.jpg/800px-Ramat_Hanadiv.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Ramat_Hanadiv.jpg/800px-Ramat_Hanadiv.jpg','seed-center-009','קל',90,false,true,true,4.7),
  ('חוף גדרה','חוף שמור עם חולות לבנות וים ירוק-כחול בדרום גוש דן','חוף','מרכז',31.776,34.631,'[]',NULL,'seed-center-010','קל',90,true,false,true,4.1),
  ('נחל שורק יהודה','שביל אביבי עם כלניות ושקמים ענקיים ביהודה','נחל','מרכז',31.783,34.912,'[]',NULL,'seed-center-011','קל',60,true,true,false,4.2)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 8 — ירושלים (Jerusalem)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('הר הצופים','הר מעל ירושלים עם תצפית מרהיבה על העיר העתיקה והמדבר','מצפה','ירושלים',31.793,35.243,'["https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Jerusalem_from_Mount_Scopus.jpg/800px-Jerusalem_from_Mount_Scopus.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Jerusalem_from_Mount_Scopus.jpg/800px-Jerusalem_from_Mount_Scopus.jpg','seed-jlm-002','קל',30,false,false,true,4.8),
  ('מערת הנטיפים שורק','מערת הנטיפים הגדולה בישראל עם תצורות גיר מרהיבות ואורות','גיאולוגיה','ירושלים',31.781,35.006,'["https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Stalactite_cave_Soreq.jpg/800px-Stalactite_cave_Soreq.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Stalactite_cave_Soreq.jpg/800px-Stalactite_cave_Soreq.jpg','seed-jlm-003','קל',60,false,false,true,4.9),
  ('נחל קדרון','שביל עתיק בנחל קדרון בין עיר דוד, גת שמנים ומדבר יהודה','נחל','ירושלים',31.774,35.238,'[]',NULL,'seed-jlm-004','בינוני',180,true,false,false,4.4),
  ('יער ירושלים','יער קק"ל ענק ממערב לירושלים עם שבילים ואתרי פיקניק','יער','ירושלים',31.779,35.141,'[]',NULL,'seed-jlm-005','קל',90,false,true,false,4.3),
  ('עין כרם מעיין','מעיין עין כרם ההיסטורי בשכונה הציורית של ירושלים','מעיין','ירושלים',31.763,35.158,'[]',NULL,'seed-jlm-006','קל',40,true,true,false,4.5),
  ('גן לאומי עיר דוד','החפירות הארכיאולוגיות בעיר הקדומה של ירושלים עם מנהרת השילוח','אתר היסטורי','ירושלים',31.774,35.237,'["https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/City_of_David.jpg/800px-City_of_David.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/City_of_David.jpg/800px-City_of_David.jpg','seed-jlm-009','קל',120,true,false,false,4.8),
  ('הר הזיתים','הר קדוש עם בית קברות יהודי עתיק ותצפית על העיר העתיקה','מצפה','ירושלים',31.777,35.247,'["https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Jerusalem_from_Mount_of_Olives.jpg/800px-Jerusalem_from_Mount_of_Olives.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Jerusalem_from_Mount_of_Olives.jpg/800px-Jerusalem_from_Mount_of_Olives.jpg','seed-jlm-010','קל',90,false,false,false,4.7),
  ('שמורת נחל כסלון','שמורת טבע בנחל כסלון עם עצי אלה ירושלמית ובתי חרדון','שמורת טבע','ירושלים',31.786,35.057,'[]',NULL,'seed-jlm-011','בינוני',120,true,true,false,4.2),
  ('נחל ערוגות עין גדי','שביל פופולרי ביהודה עם מפלים ובריכות שחייה טבעיות','נחל','ירושלים',31.618,35.347,'["https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Nahal_Arugot.jpg/800px-Nahal_Arugot.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Nahal_Arugot.jpg/800px-Nahal_Arugot.jpg','seed-jlm-013','בינוני',180,true,true,false,4.8),
  ('עין גדי מעיין דוד','מדהים — מפלים, בריכות ועיזים קלות הרגל ליד ים המלח','מעיין','ירושלים',31.462,35.391,'["https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Ein_Gedi_waterfall.jpg/800px-Ein_Gedi_waterfall.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Ein_Gedi_waterfall.jpg/800px-Ein_Gedi_waterfall.jpg','seed-jlm-014','קל',120,true,true,false,4.9),
  ('מצדה','מבצר הורדוס על מצוק דרמטי מעל ים המלח. סמל הגבורה הישראלי','אתר היסטורי','ירושלים',31.316,35.354,'["https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Masada_fortress.jpg/800px-Masada_fortress.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Masada_fortress.jpg/800px-Masada_fortress.jpg','seed-jlm-015','בינוני',180,false,false,true,5.0)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 9 — נגב (Negev)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('מכתש רמון','המכתש הגדול בעולם — 40 ק"מ אורך, 8 ק"מ רוחב. פלאי הטבע של ישראל','גיאולוגיה','נגב',30.604,34.801,'["https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Ramon_crater_Makhtesh.jpg/800px-Ramon_crater_Makhtesh.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Ramon_crater_Makhtesh.jpg/800px-Ramon_crater_Makhtesh.jpg','seed-negev-001','בינוני',240,false,false,true,5.0),
  ('מצפה רמון מצוק','תצפית דרמטית מקצה המכתש אל תוך המכתש הגיאולוגי העצום','מצפה','נגב',30.614,34.807,'["https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Mitzpe_Ramon_cliff.jpg/800px-Mitzpe_Ramon_cliff.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Mitzpe_Ramon_cliff.jpg/800px-Mitzpe_Ramon_cliff.jpg','seed-negev-002','קל',30,false,false,true,4.9),
  ('עין עבדת','מעיין ונחל עם צוקים גבוהים, עמק מוגן ומפל נדיר בנגב','מעיין','נגב',30.807,34.773,'["https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Ein_Avdat.jpg/800px-Ein_Avdat.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Ein_Avdat.jpg/800px-Ein_Avdat.jpg','seed-negev-003','בינוני',120,true,true,false,4.9),
  ('עבדת עיר נבטית','עיר נבטית עתיקה על צומת שיירות ספייסרוט — אתר מורשת עולמי','אתר היסטורי','נגב',30.792,34.776,'["https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Avdat_ruins.jpg/800px-Avdat_ruins.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Avdat_ruins.jpg/800px-Avdat_ruins.jpg','seed-negev-004','קל',90,false,false,true,4.7),
  ('מכתש הקטן','מכתש גיאולוגי קטן עם צבעי סלע מרהיבים ושבילי הייקינג','גיאולוגיה','נגב',30.944,35.143,'[]',NULL,'seed-negev-005','בינוני',150,false,false,false,4.6),
  ('מכתש הגדול','מכתש גיאולוגי גדול עם נוף פנטסטי וסלעים צבעוניים','גיאולוגיה','נגב',30.912,35.228,'[]',NULL,'seed-negev-006','בינוני',180,false,false,false,4.5),
  ('פארק תמנע','פארק מדבר עם עמוד שלמה, ציורי סלע ומכרה נחושת עתיק','גיאולוגיה','נגב',29.793,34.978,'["https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Timna_park_Israel.jpg/800px-Timna_park_Israel.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Timna_park_Israel.jpg/800px-Timna_park_Israel.jpg','seed-negev-007','קל',180,false,false,true,4.8),
  ('נחל פארן','הנחל הארוך ביותר בישראל — שביל ג׳יפים ומסלולי הרפתקה','נחל','נגב',30.318,35.112,'[]',NULL,'seed-negev-008','קשה',360,false,false,false,4.4),
  ('הר רמון פסגה','ראש ההר המשקיף על מכתש רמון מהצד הדרומי','מצפה','נגב',30.561,34.865,'[]',NULL,'seed-negev-010','קשה',240,false,false,false,4.6),
  ('שמורת חי בר','שמורת חי בר עם בעלי חיים נדירים: פרא, אוריקס ועזים','שמורת טבע','נגב',30.817,35.103,'[]',NULL,'seed-negev-012','קל',90,false,false,true,4.4),
  ('ממשית עיר נבטית','עיר נבטית-ביזנטית שמורה מרהיבה — אתר מורשת עולמי','אתר היסטורי','נגב',31.020,34.743,'[]',NULL,'seed-negev-018','קל',90,false,false,true,4.5),
  ('הר גבנונים נגב','הר מדבר עם נוף מדהים על מכתש רמון ואגן הנגב','מצפה','נגב',30.661,34.758,'[]',NULL,'seed-negev-019','בינוני',120,false,false,false,4.4),
  ('עין זיק מדבר','מעיין נדיר במדבר הנגב עם צמחייה מפתיעה','מעיין','נגב',30.683,35.063,'[]',NULL,'seed-negev-011','קשה',180,true,false,false,4.3),
  ('נחל בצרה נגב','נחל עמוק עם מפל מים עונתי ונוף נגבי דרמטי','נחל','נגב',30.527,34.862,'[]',NULL,'seed-negev-017','קשה',240,false,false,false,4.6)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 10 — ערבה (Arava)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('שמורת שחק','שמורת טבע בלב הערבה עם גיאולוגיה מדהימה וצמחיית מדבר','שמורת טבע','ערבה',30.482,35.081,'[]',NULL,'seed-arava-001','קל',90,false,false,false,4.2),
  ('עמוד שלמה תמנע','עמוד סלע גיאולוגי ענק בפארק תמנע — סמל הנגב','גיאולוגיה','ערבה',29.782,34.973,'["https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Solomons_pillars.jpg/800px-Solomons_pillars.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Solomons_pillars.jpg/800px-Solomons_pillars.jpg','seed-arava-002','קל',60,false,false,true,4.8),
  ('נחל שחרת ערבה','נחל עמוק בתוך הגבעות הוורודות של הערבה','נחל','ערבה',29.963,35.003,'[]',NULL,'seed-arava-003','קשה',240,false,false,false,4.5),
  ('מצפה שגיא','תצפית נדירה על ים סוף, ירדן, ערב הסעודית בו זמנית','מצפה','ערבה',29.833,35.008,'[]',NULL,'seed-arava-004','קל',30,false,false,false,4.7),
  ('הר ערדון ערבה','הר גבוה בערבה עם נוף דרמטי לארבע מדינות','מצפה','ערבה',30.212,35.063,'[]',NULL,'seed-arava-005','קשה',300,false,false,false,4.6),
  ('עין גרופית ערבה','מעיין בלב הערבה עם עצים ירוקים בניגוד למדבר הסובב','מעיין','ערבה',29.991,35.018,'[]',NULL,'seed-arava-007','בינוני',120,true,true,false,4.4),
  ('ציורי סלע ערבה','ציורי סלע נבטיים עתיקים החקוקים בסלעי הגיר בערבה','אתר היסטורי','ערבה',30.402,35.093,'[]',NULL,'seed-arava-008','בינוני',90,false,false,false,4.3),
  ('הר כרכום','הר מדבר עם עשרות אלפי ציורי סלע מהתקופות הקדומות','אתר היסטורי','ערבה',30.251,34.698,'[]',NULL,'seed-arava-010','קשה',360,false,false,false,4.6)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- BATCH 11 — אילת (Eilat)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
  ('שמורת האלמוגים אילת','שמורת האלמוגים באילת — שנית רף האלמוגים בעולם. חיי ים עשירים','שמורת טבע','אילת',29.504,34.916,'["https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Eilat_coral_reef.jpg/800px-Eilat_coral_reef.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Eilat_coral_reef.jpg/800px-Eilat_coral_reef.jpg','seed-eilat-001','קל',120,true,false,true,5.0),
  ('הר שלמה אילת','הר הגבוה בסביבות אילת עם תצפית על ים סוף וסיני','מצפה','אילת',29.602,34.887,'[]',NULL,'seed-eilat-002','קשה',240,false,false,false,4.7),
  ('מפרץ אילת','מפרץ עם חופים נקיים ואפשרויות ספורט ים: צלילה, גלשן, קיטסרף','חוף','אילת',29.553,34.948,'["https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Eilat_gulf.jpg/800px-Eilat_gulf.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Eilat_gulf.jpg/800px-Eilat_gulf.jpg','seed-eilat-003','קל',180,true,false,true,4.8),
  ('ואדי שלמה','נחל מדבר בלב הרי אילת עם נוף פראי ומסלולי ג׳יפים','נחל','אילת',29.581,34.896,'[]',NULL,'seed-eilat-004','בינוני',150,false,false,false,4.5),
  ('הר צפחות אילת','הר קירח עם שביל מרשים ותצפית על כל אזור אילת','מצפה','אילת',29.527,34.901,'[]',NULL,'seed-eilat-005','קשה',210,false,false,false,4.6),
  ('חוף הקורל אילת','החוף הטבעי הנפלא של אילת עם שנית האלמוגים הצבעונית','חוף','אילת',29.497,34.908,'["https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Coral_Beach_Eilat.jpg/800px-Coral_Beach_Eilat.jpg"]','https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Coral_Beach_Eilat.jpg/800px-Coral_Beach_Eilat.jpg','seed-eilat-006','קל',120,true,false,true,4.9),
  ('ואדי נטפה אילת','נחל עם בריכות טבעיות ומפלים בלב הרי אילת','נחל','אילת',29.584,34.866,'[]',NULL,'seed-eilat-008','קשה',240,true,false,false,4.7),
  ('חוף מולה אילת','חוף ים סוף שקט עם שנית אלמוגים מרהיבה','חוף','אילת',29.486,34.905,'[]',NULL,'seed-eilat-010','קל',90,true,false,false,4.6),
  ('ציורי סלע הרי אילת','ציורי סלע בני אלפי שנים של בעלי חיים בגבעות אילת','אתר היסטורי','אילת',29.612,34.952,'[]',NULL,'seed-eilat-012','בינוני',90,false,false,false,4.4),
  ('הר יהושפט אילת','הר עם שביל ייחודי ונוף עוצר נשימה על הרי אילת וים סוף','מצפה','אילת',29.648,34.899,'[]',NULL,'seed-eilat-013','קשה',240,false,false,false,4.5)
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Post-import verification queries:
-- SELECT COUNT(*), source FROM locations GROUP BY source;
-- SELECT COUNT(*), category FROM locations GROUP BY category ORDER BY count DESC;
-- SELECT r.name, COUNT(*) FROM locations l JOIN regions r ON r.id=l.region_id GROUP BY r.name;
-- Spatial: SELECT name, ST_Distance(geom, ST_MakePoint(35.2,31.8)::geography) d
--          FROM locations ORDER BY d LIMIT 10;
-- ─────────────────────────────────────────────────────────────────────────────
