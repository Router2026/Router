import { pgTable, text, integer, boolean, timestamp, jsonb, real, pgEnum, serial, numeric, varchar, customType, index } from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() { return "tsvector"; },
});

export const poiCategoryEnum = pgEnum("poi_category", [
  "restaurant",
  "coffee_trail",
  "hiking_trail",
  "attraction",
  "campsite",
]);

export const travelerTypeEnum = pgEnum("traveler_type", [
  "couple",
  "friends",
  "family",
  "solo",
]);

export const pois = pgTable("pois", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  category: poiCategoryEnum("category").notNull(),
  region: text("region").notNull(),
  description: text("description").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  subRegion: text("sub_region"),
  visitDurationMinutes: integer("visit_duration_minutes").default(60),
  openingHours: text("opening_hours"),
  sourceUrl: text("source_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dataSources = pgTable("data_sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  category: poiCategoryEnum("category").notNull(),
  sourceUrl: text("source_url").notNull(),
  syncCadenceHours: integer("sync_cadence_hours").notNull().default(168), // weekly default
  lastSyncedAt: timestamp("last_synced_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trips = pgTable("trips", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  uuid: text("uuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  travelerType: travelerTypeEnum("traveler_type").notNull(),
  groupSize: integer("group_size").notNull(),
  durationDays: integer("duration_days").notNull(),
  poiCategories: text("poi_categories").array().notNull(),
  poiAreas: text("poi_areas").array().notNull().default(["galilee", "jerusalem"]),
  poiSubAreas: text("poi_sub_areas").array().notNull().default([]),
  dayStartTime: text("day_start_time").notNull().default("09:00"),
  dayEndTime: text("day_end_time").notNull().default("20:00"),
  difficulty: text("difficulty").notNull().default("moderate"),
  startLatitude: real("start_latitude"),
  startLongitude: real("start_longitude"),
  generatedPlan: jsonb("generated_plan").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Types inferred from schema
export type Poi = typeof pois.$inferSelect;
export type NewPoi = typeof pois.$inferInsert;
export type DataSource = typeof dataSources.$inferSelect;
export type NewDataSource = typeof dataSources.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;

// ── Router App Tables ─────────────────────────────────────────────────────────

export const regions = pgTable("regions", {
  id:           serial("id").primaryKey(),
  name:         varchar("name", { length: 100 }).notNull(),
  nameEn:       varchar("name_en", { length: 100 }).notNull(),
  slug:         varchar("slug", { length: 100 }).notNull().unique(),
  centerLat:    numeric("center_lat", { precision: 10, scale: 6 }).notNull(),
  centerLng:    numeric("center_lng", { precision: 10, scale: 6 }).notNull(),
  zoom:         integer("zoom").notNull().default(11),
  radiusMeters: integer("radius_meters").notNull().default(25000),
  color:        varchar("color", { length: 7 }).notNull().default("#16a34a"),
  // geom column (GEOMETRY) managed via raw SQL only
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const locations = pgTable("locations", {
  id:              serial("id").primaryKey(),
  name:            varchar("name", { length: 255 }).notNull(),
  description:     text("description"),
  category:        varchar("category", { length: 100 }).notNull().default("טבע"),
  regionId:        integer("region_id").references(() => regions.id),
  latitude:        numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude:       numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  images:          jsonb("images").notNull().default([]),
  mainImage:       text("main_image"),
  source:          varchar("source", { length: 50 }).notNull().default("manual"),
  sourceId:        varchar("source_id", { length: 255 }),
  difficulty:      varchar("difficulty", { length: 50 }).default("בינוני"),
  durationMinutes: integer("duration_minutes"),
  hasWater:        boolean("has_water").default(false),
  hasShade:        boolean("has_shade").default(false),
  accessible:      boolean("accessible").default(false),
  averageRating:   numeric("average_rating", { precision: 3, scale: 2 }).default("4.0"),
  photoCredit:     varchar("photo_credit", { length: 255 }),
  isFeatured:      boolean("is_featured").default(false),
  uploadedBy:      varchar("uploaded_by", { length: 255 }),
  // search_vec is a tsvector generated by a DB trigger — select only, never insert
  searchVec:       tsvector("search_vec"),
  // geom column (GEOGRAPHY Point) managed via raw SQL only
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const routes = pgTable("routes", {
  id:                 serial("id").primaryKey(),
  name:               varchar("name", { length: 255 }).notNull(),
  description:        text("description"),
  regionId:           integer("region_id").references(() => regions.id),
  userId:             integer("user_id").references(() => routerUsers.id),
  totalDistanceKm:    numeric("total_distance_km", { precision: 6, scale: 2 }),
  totalDurationHours: numeric("total_duration_hours", { precision: 4, scale: 1 }),
  difficulty:         varchar("difficulty", { length: 50 }).default("בינוני"),
  groupType:          varchar("group_type", { length: 100 }).default("משפחה"),
  style:              varchar("style", { length: 100 }).default("טבע"),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  // user_id already indexed as idx_routes_user (migration 0003)
  index("idx_routes_user").on(t.userId),
  // Default sort for all listings — added in migration 0006
  index("routes_created_at_idx").on(t.createdAt),
  // Region join/filter — added in migration 0006
  index("routes_region_id_idx").on(t.regionId),
]);

export const routeStops = pgTable("route_stops", {
  id:              serial("id").primaryKey(),
  routeId:         integer("route_id").notNull().references(() => routes.id),
  locationId:      integer("location_id").references(() => locations.id),
  poiName:         varchar("poi_name", { length: 255 }),
  orderIndex:      integer("order_index").notNull().default(0),
  arrivalTime:     varchar("arrival_time", { length: 10 }),
  durationMinutes: integer("duration_minutes").default(60),
  smartInsight:    text("smart_insight"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  // route_id already indexed as idx_route_stops_route (migration 0001)
  index("idx_route_stops_route").on(t.routeId),
  // Composite: covers WHERE route_id = $1 ORDER BY order_index in one scan — migration 0006
  index("route_stops_route_id_order_idx").on(t.routeId, t.orderIndex),
]);

export const routerUsers = pgTable("users", {
  id:           serial("id").primaryKey(),
  email:        varchar("email", { length: 255 }).unique(),
  fullName:     varchar("full_name", { length: 255 }),
  displayName:  varchar("display_name", { length: 255 }),
  xpPoints:     integer("xp_points").default(0),
  level:        varchar("level", { length: 100 }).default("מטייל מתחיל"),
  reportsCount: integer("reports_count").default(0),
  reviewsCount: integer("reviews_count").default(0),
  tripsCount:   integer("trips_count").default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const syncJobs = pgTable("sync_jobs", {
  id:                 varchar("id", { length: 100 }).primaryKey(),
  source:             varchar("source", { length: 50 }).notNull(),
  status:             varchar("status", { length: 20 }).notNull().default("pending"),
  totalLocations:     integer("total_locations").default(0),
  processedLocations: integer("processed_locations").default(0),
  errorMessage:       text("error_message"),
  startedAt:          timestamp("started_at", { withTimezone: true }),
  completedAt:        timestamp("completed_at", { withTimezone: true }),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const reviews = pgTable("reviews", {
  id:           serial("id").primaryKey(),
  locationId:   integer("location_id").references(() => locations.id),
  poiName:      varchar("poi_name", { length: 255 }),
  reviewerName: varchar("reviewer_name", { length: 255 }).notNull().default("אנונימי"),
  rating:       integer("rating").notNull(),
  content:      text("content").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const communityReports = pgTable("community_reports", {
  id:           serial("id").primaryKey(),
  locationId:   integer("location_id").references(() => locations.id),
  poiName:      varchar("poi_name", { length: 255 }),
  reportType:   varchar("report_type", { length: 100 }).notNull(),
  severity:     varchar("severity", { length: 50 }).notNull().default("בינונית"),
  content:      text("content").notNull(),
  reporterName: varchar("reporter_name", { length: 255 }).notNull().default("אנונימי"),
  upvotes:      integer("upvotes").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const videoPosts = pgTable("video_posts", {
  id:           serial("id").primaryKey(),
  title:        varchar("title", { length: 255 }).notNull(),
  description:  text("description"),
  region:       varchar("region", { length: 100 }),
  uploaderName: varchar("uploader_name", { length: 255 }).notNull().default("אנונימי"),
  videoUrl:     text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  likesCount:   integer("likes_count").notNull().default(0),
  viewsCount:   integer("views_count").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Router inferred types
export type Region = typeof regions.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Route = typeof routes.$inferSelect;
export type RouteStop = typeof routeStops.$inferSelect;
export type RouterUser = typeof routerUsers.$inferSelect;
export type SyncJob = typeof syncJobs.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type CommunityReport = typeof communityReports.$inferSelect;
export type VideoPost = typeof videoPosts.$inferSelect;
