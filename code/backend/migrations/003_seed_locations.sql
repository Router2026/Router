-- Migration: 003_seed_locations.sql
-- Real Israeli nature & heritage locations with accurate coordinates

INSERT INTO locations (name, description, category, region_id, latitude, longitude, geom,
  images, main_image, source, source_id, difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes, l.has_water, l.has_shade, l.accessible, l.average_rating
FROM (VALUES
  -- ── גולן ──────────────────────────────────────────────────────────────
  ('מפל הבניאס',        'מפל מרהיב הזורם לכל אורך השנה ביער ירוק ועשיר. מסלול מהפנטם עם מים קרים ונוף ירוק.',
   'טבע', 'גולן', 33.2490, 35.6940,
   '["https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600"]',
   'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600',
   'seed-1', 'קל', 90, TRUE, TRUE, FALSE, 4.8),

  ('מבצר נמרוד',        'מבצר הצלבנים הגדול והמרשים בישראל. נוף עוצר נשימה לכל הסביבה עם היסטוריה עשירה.',
   'אתר היסטורי', 'גולן', 33.2480, 35.7150,
   '["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600"]',
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
   'seed-2', 'בינוני', 60, FALSE, FALSE, FALSE, 4.7),

  ('מפלי יהודייה',      'מסלול מים מאתגר עם מפלים יפהפיים בלב הגולן. שחייה בבריכות טבעיות.',
   'טבע', 'גולן', 32.9600, 35.7800,
   '["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600"]',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
   'seed-3', 'קשה', 300, TRUE, FALSE, FALSE, 4.6),

  ('תל דן',             'שמורת טבע ענקית עם מעיין נשר ומקורות נהר הדן. עשיר בצומח ובחי.',
   'שמורת טבע', 'גולן', 33.2480, 35.6510,
   '["https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600"]',
   'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600',
   'seed-4', 'קל - משפחות', 90, TRUE, TRUE, TRUE, 4.9),

  ('חרמון',             'ההר הגבוה בישראל עם נוף פנורמי ומרהיב. בחורף אתר סקי, בקיץ מסלולי טיול.',
   'מצפה', 'גולן', 33.4160, 35.7760,
   '["https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600"]',
   'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600',
   'seed-5', 'קשה', 240, FALSE, FALSE, FALSE, 4.9),

  -- ── גליל עליון ────────────────────────────────────────────────────────
  ('מצפה גדות',         'תצפית מרהיבה על עמק הכנרת והרי הגליל. נקודת שקיעה מושלמת.',
   'מצפה', 'גליל עליון', 33.0570, 35.5270,
   '["https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600"]',
   'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600',
   'seed-6', 'קל - משפחות', 30, FALSE, FALSE, FALSE, 5.0),

  ('נחל בניאס',         'אחד ממקורות הירדן. מסלול מרהיב עם מפלים ובריכות טבעיות.',
   'מעיין', 'גליל עליון', 33.2470, 35.6900,
   '["https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600"]',
   'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600',
   'seed-7', 'קל - משפחות', 90, TRUE, TRUE, TRUE, 5.0),

  ('נחל עיון',          'שמורת נחל עיון עם מפלים מדהימים. יפה במיוחד בעונת הגשמים.',
   'נחל', 'גליל עליון', 33.2500, 35.5620,
   '["https://images.unsplash.com/photo-1448375240586-882707db888b?w=600"]',
   'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
   'seed-8', 'בינוני', 150, TRUE, TRUE, FALSE, 4.8),

  ('מעיין התנור',       'מעיין קסום בלב יער עבות. המים קרים גם בקיץ.',
   'מעיין', 'גליל עליון', 33.0800, 35.4900,
   '["https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600"]',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
   'seed-9', 'בינוני', 120, TRUE, TRUE, FALSE, 5.0),

  -- ── גליל תחתון ────────────────────────────────────────────────────────
  ('מצוק ארבל',         'מצוק מרשים עם תצפית פנורמית על ים כנרת. מסלול עם קטעי טיפוס.',
   'מצפה', 'גליל תחתון', 32.8200, 35.5070,
   '["https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600"]',
   'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600',
   'seed-10', 'בינוני', 180, FALSE, FALSE, FALSE, 4.9),

  ('כנרת',              'ים הכנרת — אגם המים המתוקים הגדול בישראל. חופי שחייה ופעילויות.',
   'חוף', 'גליל תחתון', 32.8000, 35.5750,
   '["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600"]',
   'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
   'seed-11', 'קל - משפחות', 60, TRUE, FALSE, TRUE, 4.7),

  ('הר תבור',           'ההר הבודד של הגליל. נוף פנורמי מושלם ואתרים דתיים ותרבותיים.',
   'מצפה', 'גליל תחתון', 32.6870, 35.3940,
   '["https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600"]',
   'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600',
   'seed-12', 'בינוני', 120, FALSE, FALSE, FALSE, 4.8),

  -- ── כרמל ──────────────────────────────────────────────────────────────
  ('נחל עין חוד',       'נחל ציורי בלב הכרמל עם בריכות שחייה טבעיות.',
   'נחל', 'כרמל', 32.7000, 35.0330,
   '["https://images.unsplash.com/photo-1448375240586-882707db888b?w=600"]',
   'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
   'seed-13', 'קל', 90, TRUE, TRUE, FALSE, 4.5),

  ('נחל מערות',         'שמורת נחל מערות עם מערות קדם-היסטוריות. ירשום על שם UNESCO.',
   'שמורת טבע', 'כרמל', 32.6690, 34.9640,
   '["https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600"]',
   'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600',
   'seed-14', 'קל - משפחות', 120, FALSE, TRUE, TRUE, 4.7),

  -- ── מרכז ──────────────────────────────────────────────────────────────
  ('נחל קנה',           'נחל יפהפה עם בריכות שחייה טבעיות וצל מפכיח.',
   'נחל', 'מרכז', 32.1720, 35.0020,
   '["https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600"]',
   'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600',
   'seed-15', 'קל', 90, TRUE, TRUE, FALSE, 4.5),

  ('גן לאומי אפולוניה', 'מצודת ימי ביניים על ראש כף ים. נוף מפהיק לים התיכון.',
   'אתר היסטורי', 'שרון', 32.1990, 34.8200,
   '["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600"]',
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
   'seed-16', 'קל - משפחות', 60, FALSE, FALSE, FALSE, 4.4),

  -- ── ירושלים ───────────────────────────────────────────────────────────
  ('עיר דוד',           'לב ירושלים העתיקה. מנהרת שילוח וחפירות ארכיאולוגיות מרתקות.',
   'אתר היסטורי', 'ירושלים', 31.7720, 35.2350,
   '["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600"]',
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
   'seed-17', 'קל', 120, FALSE, FALSE, FALSE, 4.8),

  ('גן לאומי עין גדי',  'שמורת טבע מדהימה בחוף ים המלח. מפלים, בריכות ובעלי חיים.',
   'שמורת טבע', 'יהודה ושומרון', 31.4620, 35.3900,
   '["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600"]',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
   'seed-18', 'בינוני', 180, TRUE, TRUE, FALSE, 4.9),

  ('מצדה',              'מצודת הרודוס על מצוק מדברי. סמל ההתנגדות היהודית.',
   'אתר היסטורי', 'יהודה ושומרון', 31.3156, 35.3533,
   '["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600"]',
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
   'seed-19', 'בינוני', 180, FALSE, FALSE, FALSE, 4.9),

  -- ── דרום ──────────────────────────────────────────────────────────────
  ('מכתש רמון',         'הקרטר הגדול ביותר בעולם — נס גיאולוגי ייחודי. נוף מדברי עוצר נשימה.',
   'גיאולוגיה', 'נגב', 30.5980, 34.8020,
   '["https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600"]',
   'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600',
   'seed-20', 'בינוני', 240, FALSE, FALSE, FALSE, 4.9),

  ('שדות בר',           'שדות פרחי בר עוצרי נשימה באביב. מיליוני פרחים צבעוניים.',
   'טבע', 'דרום', 31.3500, 34.7000,
   '["https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600"]',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
   'seed-21', 'קל - משפחות', 60, FALSE, FALSE, FALSE, 4.6),

  -- ── אילת ──────────────────────────────────────────────────────────────
  ('שמורת האלמוגים',    'שמורת טבע ימית עם שוניות אלמוגים צבעוניות ודגים טרופיים.',
   'חוף', 'אילת', 29.5100, 34.9280,
   '["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600"]',
   'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
   'seed-22', 'קל - משפחות', 120, TRUE, FALSE, TRUE, 4.8),

  ('הר שלמה',           'שביל ירידה מרהיב בהרי אילת עם נוף מדברי חי צבעים.',
   'טבע', 'אילת', 29.6080, 34.9680,
   '["https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600"]',
   'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600',
   'seed-23', 'קשה', 300, FALSE, FALSE, FALSE, 4.7),

  -- ── ערבה ──────────────────────────────────────────────────────────────
  ('תמנע',              'פארק תמנע עם כרות נחושת עתיקים, עמודי שלמה ואגם.',
   'גיאולוגיה', 'ערבה', 29.7840, 35.0060,
   '["https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600"]',
   'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600',
   'seed-24', 'קל - משפחות', 180, FALSE, FALSE, FALSE, 4.6),

  -- ── עמק יזרעאל ────────────────────────────────────────────────────────
  ('הר הכרמל',         'פסגת הכרמל עם מרכז מבקרים ומסלולי טיול מגוונים.',
   'מצפה', 'עמק יזרעאל', 32.7500, 35.0500,
   '["https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600"]',
   'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600',
   'seed-25', 'בינוני', 120, FALSE, TRUE, FALSE, 4.5)

) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;
