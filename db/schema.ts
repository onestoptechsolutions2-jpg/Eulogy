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
  id: text("id").primaryKey(), // nanoid
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// single-use magic-link tokens
export const loginTokens = pgTable("login_tokens", {
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

export const editSuggestions = pgTable("edit_suggestions", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  suggestedByUserId: text("suggested_by_user_id").notNull().references(() => users.id),
  field: text("field").notNull(),
  value: text("value").notNull(),
  status: text("status").notNull().default("pending"), // pending | applied | dismissed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Tree = typeof trees.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Family = typeof families.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
