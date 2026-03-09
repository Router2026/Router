// ── Mock API — mimics Base44 ─────────────────────────────────────────────────

export interface POI {
  id: string; name: string; category: string; region: string;
  average_rating: number; main_image: string; difficulty: string;
  latitude: number; longitude: number; description: string;
  duration_minutes?: number; has_water?: boolean; has_shade?: boolean;
  accessible?: boolean;
}

/** All POIs — keyed region names match REGIONS below */
const ALL_POIS: POI[] = [
  // גולן
  { id: 'p1', name: 'מפל הבניאס', category: 'טבע', region: 'גולן',
    average_rating: 4.8, main_image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600',
    difficulty: 'קל', latitude: 33.249, longitude: 35.694,
    description: 'מפל מרהיב הזורם לכל אורך השנה ביער ירוק ועשיר. מסלול מהפנטם עם מים קרים.', duration_minutes: 90, has_water: true, has_shade: true },
  { id: 'p2', name: 'מבצר נמרוד', category: 'אתר היסטורי', region: 'גולן',
    average_rating: 4.7, main_image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
    difficulty: 'בינוני', latitude: 33.248, longitude: 35.715,
    description: 'מבצר הצלבנים הגדול והמרשים בישראל. נוף עוצר נשימה לכל הסביבה.', duration_minutes: 60, has_shade: false },
  { id: 'p3', name: 'מפלי יהודייה', category: 'טבע', region: 'גולן',
    average_rating: 4.6, main_image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
    difficulty: 'קשה', latitude: 32.960, longitude: 35.780,
    description: 'מסלול מים מאתגר עם מפלים יפהפיים בלב הגולן.', duration_minutes: 300, has_water: true },

  // גליל עליון
  { id: 'p4', name: 'מצפה גדות', category: 'מצפה', region: 'גליל עליון',
    average_rating: 5.0, main_image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600',
    difficulty: 'קל - משפחות', latitude: 33.057, longitude: 35.527,
    description: 'תצפית מרהיבה על עמק הכנרת והרי הגליל. נקודת שקיעה מושלמת עם מבט על כל הצפון.', duration_minutes: 30, has_shade: false },
  { id: 'p5', name: 'נחל בניאס', category: 'מעיין', region: 'גליל עליון',
    average_rating: 5.0, main_image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600',
    difficulty: 'קל - משפחות', latitude: 33.247, longitude: 35.690,
    description: 'אחד ממקורות הירדן. מסלול מרהיב עם מפלים ובריכות טבעיות. מושלם למשפחות עם שביל מוצל ומים קרים.', duration_minutes: 90, has_water: true, has_shade: true, accessible: true },
  { id: 'p6', name: 'מעיין התנור - עין תנור', category: 'מעיין', region: 'גליל עליון',
    average_rating: 5.0, main_image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
    difficulty: 'בינוני', latitude: 33.080, longitude: 35.490,
    description: 'מעיין קסום בלב יער עבות. המים קרים גם בקיץ ביותר והמקום מוצל.', duration_minutes: 120, has_water: true, has_shade: true },

  // גליל תחתון
  { id: 'p7', name: 'מצוק ארבל', category: 'מצפה', region: 'גליל תחתון',
    average_rating: 4.9, main_image: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600',
    difficulty: 'בינוני', latitude: 32.820, longitude: 35.507,
    description: 'מצוק מרשים עם תצפית פנורמית על ים כנרת וגליל. מסלול עם קטעי טיפוס מרתקים.', duration_minutes: 180 },
  { id: 'p8', name: 'כנרת', category: 'חוף', region: 'גליל תחתון',
    average_rating: 4.7, main_image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
    difficulty: 'קל - משפחות', latitude: 32.800, longitude: 35.575,
    description: 'ים הכנרת, אגם המים המתוקים הגדול בישראל. חופי שחייה ופעילויות מים.', duration_minutes: 60, has_water: true, accessible: true },

  // כרמל
  { id: 'p9', name: 'נחל עין חוד', category: 'נחל', region: 'כרמל',
    average_rating: 4.5, main_image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
    difficulty: 'קל', latitude: 32.700, longitude: 35.033,
    description: 'נחל ציורי בלב הכרמל עם בריכות שחייה טבעיות וצל עבות.', duration_minutes: 90, has_water: true, has_shade: true },

  // מרכז
  { id: 'p10', name: 'נחל קנה', category: 'נחל', region: 'מרכז',
    average_rating: 4.5, main_image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600',
    difficulty: 'קל', latitude: 32.172, longitude: 35.002,
    description: 'נחל יפהפה עם בריכות שחייה טבעיות וצל מפכיח.', duration_minutes: 90, has_water: true, has_shade: true },

  // ירושלים
  { id: 'p11', name: 'עיר דוד', category: 'אתר היסטורי', region: 'ירושלים',
    average_rating: 4.8, main_image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
    difficulty: 'קל', latitude: 31.772, longitude: 35.235,
    description: 'לב ירושלים העתיקה. מנהרת שילוח וחפירות ארכיאולוגיות מרתקות.', duration_minutes: 120 },

  // דרום
  { id: 'p12', name: 'מכתש רמון', category: 'גיאולוגיה', region: 'דרום',
    average_rating: 4.9, main_image: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600',
    difficulty: 'בינוני', latitude: 30.598, longitude: 34.802,
    description: 'הקרטר הגדול ביותר בעולם — נס גיאולוגי ייחודי. נוף מדברי עוצר נשימה.', duration_minutes: 240 },

  // אילת
  { id: 'p13', name: 'שמורת האלמוגים', category: 'חוף', region: 'אילת',
    average_rating: 4.8, main_image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
    difficulty: 'קל - משפחות', latitude: 29.510, longitude: 34.928,
    description: 'שמורת טבע ימית עם שוניות אלמוגים צבעוניות ודגים טרופיים.', duration_minutes: 120, has_water: true, accessible: true },
];

const MOCK_TRIPS = [
  { id: 't1', name: 'מסלול טיול לגליל עליון', region: 'גליל עליון', total_duration_hours: 3, group_type: 'משפחה עם ילדים', style: 'צילום',
    stops: [
      { poi_name: 'מפל הבניאס', arrival_time: '09:00', duration_minutes: 90, smart_insight: 'להגיע בבוקר כדי להימנע מעומס' },
      { poi_name: 'תל דן', arrival_time: '11:00', duration_minutes: 60, smart_insight: 'אתר ארכיאולוגי מרתק לילדים' }
    ]
  },
  { id: 't2', name: 'מסלול טיול בגליל העליון', region: 'גליל עליון', total_duration_hours: 5, group_type: 'חברים', style: 'מים',
    stops: [
      { poi_name: 'נחל עיון', arrival_time: '08:00', duration_minutes: 120, smart_insight: 'מים קרירים מושלמים לקיץ' },
      { poi_name: 'מפלים בצפון', arrival_time: '10:30', duration_minutes: 90, smart_insight: 'מצוין לצילומים' }
    ]
  },
  { id: 't3', name: 'טיול מים בגליל עליון', region: 'גליל עליון', total_duration_hours: 4, group_type: 'יחיד', style: 'מים', stops: [] },
  { id: 't4', name: 'מסלול טיול בגליל העליון', region: 'גליל עליון', total_duration_hours: 5, group_type: 'זוג', style: 'היסטוריה', stops: [] },
  { id: 't5', name: 'טיול זוגי בגליל עליון', region: 'גליל עליון', total_duration_hours: 5, group_type: 'זוג', style: 'מים', stops: [] },
];

export const base44 = {
  auth: {
    me: async () => ({ id: 'u1', email: 'omri@example.com', full_name: 'עומרי חליפה' })
  },
  entities: {
    POI: {
      list: async () => ALL_POIS,
      filter: async (params?: { region?: string }) => {
        if (params?.region) return ALL_POIS.filter(p => p.region === params.region);
        return ALL_POIS;
      },
      get: async (id: string) => ALL_POIS.find(p => p.id === id) || ALL_POIS[0],
      update: async (id: string, data: any) => ({ id, ...data })
    },
    Trip: {
      filter: async () => MOCK_TRIPS,
      create: async (data: any) => ({ id: `t_${Date.now()}`, ...data })
    },
    Review: {
      filter: async () => [
        { id: 'r1', poi_id: 'p1', reviewer_name: 'ישראל ישראלי', rating: 5, content: 'מקום מדהים! המים קרים ומרעננים, הנוף פנטסטי.', created_date: new Date().toISOString() },
        { id: 'r2', poi_id: 'p1', reviewer_name: 'שרה כהן', rating: 4, content: 'מקום נהדר, קצת עמוס בסופ"ש אבל שווה.', created_date: new Date().toISOString() }
      ],
      create: async (data: any) => ({ id: `r_${Date.now()}`, ...data })
    },
    CommunityReport: {
      filter: async () => [
        { id: 'rep1', poi_name: 'מפל הבניאס', report_type: 'צפיפות', severity: 'גבוהה', content: 'עמוס מאוד היום - ממליץ להגיע מוקדם בבוקר', reporter_name: 'עומרי', upvotes: 10, created_date: new Date().toISOString() },
        { id: 'rep2', poi_name: 'מצוק ארבל', report_type: 'מצב שביל', severity: 'בינונית', content: 'חלק מהשביל רטוב, כדאי להביא נעלי הליכה', reporter_name: 'מיכל', upvotes: 5, created_date: new Date().toISOString() },
        { id: 'rep3', poi_name: 'נחל קנה', report_type: 'מצב מים', severity: 'נמוכה', content: 'המים בגובה נמוך יחסית, אפשר לשחות', reporter_name: 'דוד', upvotes: 3, created_date: new Date().toISOString() }
      ],
      create: async (data: any) => ({ id: `rep_${Date.now()}`, ...data }),
      update: async (id: string, data: any) => ({ id, ...data })
    },
    UserProfile: {
      filter: async () => [
        { id: 'up1', user_id: 'u1', display_name: 'עומרי חליפה', xp_points: 0, level: 'מטייל מתחיל', reports_count: 0, reviews_count: 0, trips_count: 10 }
      ],
      list: async () => [
        { id: 'up1', display_name: 'עומרי חליפה', xp_points: 1250, level: 'שועל שטח' },
        { id: 'up2', display_name: 'שרה לוי', xp_points: 980, level: 'חוקר' },
        { id: 'up3', display_name: 'יואב כהן', xp_points: 850, level: 'חוקר' },
        { id: 'up4', display_name: 'נועה ברק', xp_points: 720, level: 'מתחיל' },
        { id: 'up5', display_name: 'גיל שמש', xp_points: 650, level: 'מתחיל' }
      ],
      create: async (data: any) => ({ id: 'up_new', ...data }),
      update: async (id: string, data: any) => ({ id, ...data })
    },
    VideoPost: {
      list: async () => [
        { id: 'v1', title: 'שחייה במפל הבניאס', uploader_name: 'עומרי', likes_count: 42, thumbnail_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', region: 'גולן', views_count: 1200 },
        { id: 'v2', title: 'שקיעה בגליל עליון', uploader_name: 'שרה', likes_count: 38, thumbnail_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600', region: 'גליל עליון', views_count: 890 },
        { id: 'v3', title: 'טיול במכתש רמון', uploader_name: 'דוד', likes_count: 27, thumbnail_url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600', region: 'דרום', views_count: 560 }
      ],
      filter: async () => [],
      create: async (data: any) => ({ id: `v_${Date.now()}`, ...data }),
      update: async (id: string, data: any) => ({ id, ...data })
    }
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }: { file: File }) => ({ file_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800' }),
      InvokeLLM: async ({ body }: { body: string }) => {
        const req = JSON.parse(body);
        const region = req.region || 'גליל עליון';
        return {
          name: `טיול ${req.style || 'טבע'} ב${region}`,
          description: `מסלול מותאם אישית ב${region} עבור ${req.group_type || 'משפחה'}`,
          stops: [
            { poi_name: 'נחל עיון', arrival_time: '08:00', duration_minutes: 90, smart_insight: 'להגיע בבוקר לפני העומס' },
            { poi_name: 'מפלים בצפון', arrival_time: '10:30', duration_minutes: 60, smart_insight: 'מצוין לצילומים - אור נפלא בשעה זו' },
            { poi_name: 'מפלים בברעם', arrival_time: '12:30', duration_minutes: 60, smart_insight: 'המים קרים - מומלץ להגיע עם בגדי ים' },
            { poi_name: 'נחל מחזיה', arrival_time: '14:00', duration_minutes: 90, smart_insight: 'מקום מושלם לפיקניק במים' },
            { poi_name: 'כפר מסריק - פיקניק סיום', arrival_time: '15:30', duration_minutes: 60, smart_insight: 'אך תיזהרו מעצי שהשאירו אותם על הקרקע!' }
          ],
          total_duration_hours: req.duration_hours || 6,
          total_distance_km: 18
        };
      }
    }
  }
};

export { ALL_POIS };
