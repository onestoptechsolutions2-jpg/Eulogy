import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// --- accounts & access -------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  image: text("image").notNull().default(""),
  passwordHash: text("password_hash").notNull().default(""), // scrypt$salt$hash, "" = OAuth-only
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const trees = pgTable("trees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// role: owner | editor | contributor | viewer
export const treeMembers = pgTable(
  "tree_members",
  {
    treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.treeId, t.userId] })],
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("contributor"),
    // if set, the invitee auto-claims this person on accept
    personId: text("person_id"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitations_email_idx").on(t.email)],
);

// --- genealogy -------------------------------------------------------
// Cross-references between the three genealogy tables are plain text
// handles, not FKs: the Gramps importer reloads all three together, so
// FKs would only add ordering pain.

export const people = pgTable(
  "people",
  {
    id: text("id").primaryKey(), // = gramps handle when imported, else nanoid
    treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    grampsId: text("gramps_id").notNull().default(""),
    given: text("given").notNull().default(""),
    surname: text("surname").notNull().default(""),
    prefix: text("prefix").notNull().default(""),
    suffix: text("suffix").notNull().default(""),
    title: text("title").notNull().default(""),
    nick: text("nick").notNull().default(""),
    gender: text("gender").notNull().default("U"), // M | F | U
    birthDate: text("birth_date").notNull().default(""),
    deathDate: text("death_date").notNull().default(""),
    living: boolean("living").notNull().default(true),
    claimedByUserId: text("claimed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    photoUrl: text("photo_url").notNull().default(""),
    coverUrl: text("cover_url").notNull().default(""),
    bio: text("bio").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("people_tree_idx").on(t.treeId)],
);

export const families = pgTable(
  "families",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    grampsId: text("gramps_id").notNull().default(""),
    partner1Id: text("partner1_id"),
    partner2Id: text("partner2_id"),
    relType: text("rel_type").notNull().default("Unknown"),
  },
  (t) => [index("families_tree_idx").on(t.treeId)],
);

export const familyChildren = pgTable(
  "family_children",
  {
    familyId: text("family_id").notNull(),
    childId: text("child_id").notNull(),
    seq: integer("seq").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.familyId, t.childId] }),
    index("family_children_child_idx").on(t.childId),
  ],
);

// --- family feed (posts & stories) ---------------------------------------

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull().default(""),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    aboutPersonId: text("about_person_id"),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("posts_tree_created_idx").on(t.treeId, t.createdAt)],
);

export type Post = typeof posts.$inferSelect;

export const editSuggestions = pgTable("edit_suggestions", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  suggestedByUserId: text("suggested_by_user_id").notNull().references(() => users.id),
  field: text("field").notNull(),
  value: text("value").notNull(),
  status: text("status").notNull().default("pending"), // pending | applied | dismissed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- photos & life events ---------------------------------------------

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    personId: text("person_id"),
    kind: text("kind").notNull().default("gallery"), // avatar | cover | gallery
    mimeType: text("mime_type").notNull(),
    data: text("data").notNull(), // base64-encoded bytes
    byteSize: integer("byte_size").notNull().default(0),
    caption: text("caption").notNull().default(""),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("media_person_idx").on(t.personId, t.createdAt),
    index("media_tree_idx").on(t.treeId, t.createdAt),
  ],
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull(),
    kind: text("kind").notNull().default("custom"),
    title: text("title").notNull().default(""),
    date: text("date").notNull().default(""),
    place: text("place").notNull().default(""),
    note: text("note").notNull().default(""),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_person_idx").on(t.personId)],
);

// --- shared eulogy ---------------------------------------------------

export const eulogies = pgTable("eulogies", {
  id: text("id").primaryKey(),
  treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull(),
  title: text("title").notNull().default(""),
  intro: text("intro").notNull().default(""),
  shareToken: text("share_token").notNull().unique(),
  linkEnabled: boolean("link_enabled").notNull().default(false),
  allowTributes: boolean("allow_tributes").notNull().default(true),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eulogyEntries = pgTable(
  "eulogy_entries",
  {
    id: text("id").primaryKey(),
    eulogyId: text("eulogy_id").notNull().references(() => eulogies.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull().default(""),
    relationship: text("relationship").notNull().default(""),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("published"), // published | pending | dismissed
    source: text("source").notNull().default("member"), // member | link
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("eulogy_entries_eulogy_idx").on(t.eulogyId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Tree = typeof trees.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Family = typeof families.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Media = typeof media.$inferSelect;
export type LifeEvent = typeof events.$inferSelect;
export type Eulogy = typeof eulogies.$inferSelect;
export type EulogyEntry = typeof eulogyEntries.$inferSelect;
