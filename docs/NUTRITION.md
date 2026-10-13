# Food diary

Open Food diary from the Home card. The existing navigation and training views stay in place.

Log foods under breakfast, lunch, dinner or snacks, with a date, time, quantity, notes and optional energy, protein, carbohydrate, fat, fibre, sugar and sodium values. Choose grams, millilitres or servings:

- **Per 100 g / ml:** label values scale to the quantity logged.
- **Per serving:** values scale to the number of servings.
- **Whole portion:** entered values already describe the complete logged portion.

The app does not guess nutrient values from a name. Empty values remain unknown; totals cover known values only and show `+` where incomplete. Use packaging or another reliable source for the values.

Foods can be edited, deleted, saved as favourites or copied. Copy previous day copies foods into the selected day without duplicating water. A past meal can also be copied to today. Copying asks for confirmation and gives every new entry its own id.

Water has its own quick additions and history. Daily targets are optional and manually chosen. Day notes and a 1–5 hunger rating are optional. Calendar markers show recorded days; the seven-day view shows logged calories and an average over days with known energy values, not artificial zeroes for missing days or unknown calories. A `+` marks incomplete energy totals.

Export the full diary as CSV; the mobile app uses the system share sheet. All diary content is also part of the existing JSON backup and native file persistence. Entries, favourites and day notes merge by their own timestamps. Deleted entries keep a tombstone so an offline device cannot bring them back. Nutrition quantities stay in grams/millilitres regardless of lifting weight-unit changes.

This is a manual diary: it has no remote food database, barcode service, photo recognition or automatic dietary prescriptions. Health Connect is optional and is not needed for diary features.
