import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
export const studioState = sqliteTable("studio_state", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  data: text("data").notNull(),
});
