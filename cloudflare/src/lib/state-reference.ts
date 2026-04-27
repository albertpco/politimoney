/**
 * Reference data for state-level data integrity tests.
 *
 * This is the "expected" dataset — if our ingestion pipeline or repository
 * returns data that contradicts this reference, the test fails and we know
 * something is wrong.
 *
 * Sources:
 *   - Senators/Reps: congress.gov (119th Congress, 2025-2027)
 *   - Governors: National Governors Association (as of 2025)
 *   - House seat counts: US Census apportionment (2020)
 */

export type StateReference = {
  code: string;
  name: string;
  /** Current governor (name). */
  governor: string;
  /** Governor party: D, R, I */
  governorParty: "D" | "R" | "I";
  /** Number of House seats (from 2020 apportionment). */
  houseSeats: number;
  /** Expected 2 senators per state (names). */
  senators: [string, string];
  /** Senator parties (same order as senators). */
  senatorParties: [string, string];
  /** Minimum population we'd expect (sanity check). */
  minPopulation: number;
};

/**
 * 50-state reference data.
 * Updated: April 2025 (119th Congress).
 */
export const STATE_REFERENCE: StateReference[] = [
  { code: "AL", name: "Alabama", governor: "Kay Ivey", governorParty: "R", houseSeats: 7, senators: ["Tommy Tuberville", "Katie Britt"], senatorParties: ["R", "R"], minPopulation: 4_500_000 },
  { code: "AK", name: "Alaska", governor: "Mike Dunleavy", governorParty: "R", houseSeats: 1, senators: ["Lisa Murkowski", "Dan Sullivan"], senatorParties: ["R", "R"], minPopulation: 700_000 },
  { code: "AZ", name: "Arizona", governor: "Katie Hobbs", governorParty: "D", houseSeats: 9, senators: ["Ruben Gallego", "Mark Kelly"], senatorParties: ["D", "D"], minPopulation: 7_000_000 },
  { code: "AR", name: "Arkansas", governor: "Sarah Huckabee Sanders", governorParty: "R", houseSeats: 4, senators: ["John Boozman", "Tom Cotton"], senatorParties: ["R", "R"], minPopulation: 2_900_000 },
  { code: "CA", name: "California", governor: "Gavin Newsom", governorParty: "D", houseSeats: 52, senators: ["Alex Padilla", "Adam Schiff"], senatorParties: ["D", "D"], minPopulation: 38_000_000 },
  { code: "CO", name: "Colorado", governor: "Jared Polis", governorParty: "D", houseSeats: 8, senators: ["Michael Bennet", "John Hickenlooper"], senatorParties: ["D", "D"], minPopulation: 5_500_000 },
  { code: "CT", name: "Connecticut", governor: "Ned Lamont", governorParty: "D", houseSeats: 5, senators: ["Richard Blumenthal", "Chris Murphy"], senatorParties: ["D", "D"], minPopulation: 3_500_000 },
  { code: "DE", name: "Delaware", governor: "Matt Meyer", governorParty: "D", houseSeats: 1, senators: ["Lisa Blunt Rochester", "Chris Coons"], senatorParties: ["D", "D"], minPopulation: 950_000 },
  { code: "FL", name: "Florida", governor: "Ron DeSantis", governorParty: "R", houseSeats: 28, senators: ["Rick Scott", "Ashley Moody"], senatorParties: ["R", "R"], minPopulation: 21_000_000 },
  { code: "GA", name: "Georgia", governor: "Brian Kemp", governorParty: "R", houseSeats: 14, senators: ["Jon Ossoff", "Raphael Warnock"], senatorParties: ["D", "D"], minPopulation: 10_000_000 },
  { code: "HI", name: "Hawaii", governor: "Josh Green", governorParty: "D", houseSeats: 2, senators: ["Brian Schatz", "Mazie Hirono"], senatorParties: ["D", "D"], minPopulation: 1_400_000 },
  { code: "ID", name: "Idaho", governor: "Brad Little", governorParty: "R", houseSeats: 2, senators: ["Mike Crapo", "Jim Risch"], senatorParties: ["R", "R"], minPopulation: 1_700_000 },
  { code: "IL", name: "Illinois", governor: "JB Pritzker", governorParty: "D", houseSeats: 17, senators: ["Dick Durbin", "Tammy Duckworth"], senatorParties: ["D", "D"], minPopulation: 12_500_000 },
  { code: "IN", name: "Indiana", governor: "Mike Braun", governorParty: "R", houseSeats: 9, senators: ["Todd Young", "Jim Banks"], senatorParties: ["R", "R"], minPopulation: 6_500_000 },
  { code: "IA", name: "Iowa", governor: "Kim Reynolds", governorParty: "R", houseSeats: 4, senators: ["Chuck Grassley", "Joni Ernst"], senatorParties: ["R", "R"], minPopulation: 3_100_000 },
  { code: "KS", name: "Kansas", governor: "Laura Kelly", governorParty: "D", houseSeats: 4, senators: ["Jerry Moran", "Roger Marshall"], senatorParties: ["R", "R"], minPopulation: 2_900_000 },
  { code: "KY", name: "Kentucky", governor: "Andy Beshear", governorParty: "D", houseSeats: 6, senators: ["Mitch McConnell", "Rand Paul"], senatorParties: ["R", "R"], minPopulation: 4_400_000 },
  { code: "LA", name: "Louisiana", governor: "Jeff Landry", governorParty: "R", houseSeats: 6, senators: ["Bill Cassidy", "John Kennedy"], senatorParties: ["R", "R"], minPopulation: 4_500_000 },
  { code: "ME", name: "Maine", governor: "Janet Mills", governorParty: "D", houseSeats: 2, senators: ["Susan Collins", "Angus King"], senatorParties: ["R", "I"], minPopulation: 1_300_000 },
  { code: "MD", name: "Maryland", governor: "Wes Moore", governorParty: "D", houseSeats: 8, senators: ["Angela Alsobrooks", "Chris Van Hollen"], senatorParties: ["D", "D"], minPopulation: 6_000_000 },
  { code: "MA", name: "Massachusetts", governor: "Maura Healey", governorParty: "D", houseSeats: 9, senators: ["Elizabeth Warren", "Ed Markey"], senatorParties: ["D", "D"], minPopulation: 6_800_000 },
  { code: "MI", name: "Michigan", governor: "Gretchen Whitmer", governorParty: "D", houseSeats: 13, senators: ["Gary Peters", "Elissa Slotkin"], senatorParties: ["D", "D"], minPopulation: 9_900_000 },
  { code: "MN", name: "Minnesota", governor: "Tim Walz", governorParty: "D", houseSeats: 8, senators: ["Amy Klobuchar", "Tina Smith"], senatorParties: ["D", "D"], minPopulation: 5_600_000 },
  { code: "MS", name: "Mississippi", governor: "Tate Reeves", governorParty: "R", houseSeats: 4, senators: ["Roger Wicker", "Cindy Hyde-Smith"], senatorParties: ["R", "R"], minPopulation: 2_900_000 },
  { code: "MO", name: "Missouri", governor: "Mike Kehoe", governorParty: "R", houseSeats: 8, senators: ["Josh Hawley", "Eric Schmitt"], senatorParties: ["R", "R"], minPopulation: 6_100_000 },
  { code: "MT", name: "Montana", governor: "Greg Gianforte", governorParty: "R", houseSeats: 2, senators: ["Steve Daines", "Tim Sheehy"], senatorParties: ["R", "R"], minPopulation: 1_000_000 },
  { code: "NE", name: "Nebraska", governor: "Jim Pillen", governorParty: "R", houseSeats: 3, senators: ["Deb Fischer", "Pete Ricketts"], senatorParties: ["R", "R"], minPopulation: 1_900_000 },
  { code: "NV", name: "Nevada", governor: "Joe Lombardo", governorParty: "R", houseSeats: 4, senators: ["Catherine Cortez Masto", "Jacky Rosen"], senatorParties: ["D", "D"], minPopulation: 3_000_000 },
  { code: "NH", name: "New Hampshire", governor: "Kelly Ayotte", governorParty: "R", houseSeats: 2, senators: ["Jeanne Shaheen", "Maggie Hassan"], senatorParties: ["D", "D"], minPopulation: 1_300_000 },
  { code: "NJ", name: "New Jersey", governor: "Phil Murphy", governorParty: "D", houseSeats: 12, senators: ["Cory Booker", "Andy Kim"], senatorParties: ["D", "D"], minPopulation: 8_800_000 },
  { code: "NM", name: "New Mexico", governor: "Michelle Lujan Grisham", governorParty: "D", houseSeats: 3, senators: ["Martin Heinrich", "Ben Ray Luján"], senatorParties: ["D", "D"], minPopulation: 2_000_000 },
  { code: "NY", name: "New York", governor: "Kathy Hochul", governorParty: "D", houseSeats: 26, senators: ["Chuck Schumer", "Kirsten Gillibrand"], senatorParties: ["D", "D"], minPopulation: 19_000_000 },
  { code: "NC", name: "North Carolina", governor: "Josh Stein", governorParty: "D", houseSeats: 14, senators: ["Thom Tillis", "Ted Budd"], senatorParties: ["R", "R"], minPopulation: 10_000_000 },
  { code: "ND", name: "North Dakota", governor: "Kelly Armstrong", governorParty: "R", houseSeats: 1, senators: ["John Hoeven", "Kevin Cramer"], senatorParties: ["R", "R"], minPopulation: 750_000 },
  { code: "OH", name: "Ohio", governor: "Mike DeWine", governorParty: "R", houseSeats: 15, senators: ["Jon Husted", "Bernie Moreno"], senatorParties: ["R", "R"], minPopulation: 11_500_000 },
  { code: "OK", name: "Oklahoma", governor: "Kevin Stitt", governorParty: "R", houseSeats: 5, senators: ["James Lankford", "Markwayne Mullin"], senatorParties: ["R", "R"], minPopulation: 3_900_000 },
  { code: "OR", name: "Oregon", governor: "Tina Kotek", governorParty: "D", houseSeats: 6, senators: ["Ron Wyden", "Jeff Merkley"], senatorParties: ["D", "D"], minPopulation: 4_200_000 },
  { code: "PA", name: "Pennsylvania", governor: "Josh Shapiro", governorParty: "D", houseSeats: 17, senators: ["David McCormick", "John Fetterman"], senatorParties: ["R", "D"], minPopulation: 12_800_000 },
  { code: "RI", name: "Rhode Island", governor: "Dan McKee", governorParty: "D", houseSeats: 2, senators: ["Jack Reed", "Sheldon Whitehouse"], senatorParties: ["D", "D"], minPopulation: 1_050_000 },
  { code: "SC", name: "South Carolina", governor: "Henry McMaster", governorParty: "R", houseSeats: 7, senators: ["Lindsey Graham", "Tim Scott"], senatorParties: ["R", "R"], minPopulation: 5_100_000 },
  { code: "SD", name: "South Dakota", governor: "Larry Rhoden", governorParty: "R", houseSeats: 1, senators: ["John Thune", "Mike Rounds"], senatorParties: ["R", "R"], minPopulation: 880_000 },
  { code: "TN", name: "Tennessee", governor: "Bill Lee", governorParty: "R", houseSeats: 9, senators: ["Marsha Blackburn", "Bill Hagerty"], senatorParties: ["R", "R"], minPopulation: 6_800_000 },
  { code: "TX", name: "Texas", governor: "Greg Abbott", governorParty: "R", houseSeats: 38, senators: ["John Cornyn", "Ted Cruz"], senatorParties: ["R", "R"], minPopulation: 28_000_000 },
  { code: "UT", name: "Utah", governor: "Spencer Cox", governorParty: "R", houseSeats: 4, senators: ["Mike Lee", "John Curtis"], senatorParties: ["R", "R"], minPopulation: 3_200_000 },
  { code: "VT", name: "Vermont", governor: "Phil Scott", governorParty: "R", houseSeats: 1, senators: ["Bernie Sanders", "Peter Welch"], senatorParties: ["I", "D"], minPopulation: 620_000 },
  { code: "VA", name: "Virginia", governor: "Glenn Youngkin", governorParty: "R", houseSeats: 11, senators: ["Mark Warner", "Tim Kaine"], senatorParties: ["D", "D"], minPopulation: 8_500_000 },
  { code: "WA", name: "Washington", governor: "Bob Ferguson", governorParty: "D", houseSeats: 10, senators: ["Patty Murray", "Maria Cantwell"], senatorParties: ["D", "D"], minPopulation: 7_500_000 },
  { code: "WV", name: "West Virginia", governor: "Patrick Morrisey", governorParty: "R", houseSeats: 2, senators: ["Shelley Moore Capito", "Jim Justice"], senatorParties: ["R", "R"], minPopulation: 1_700_000 },
  { code: "WI", name: "Wisconsin", governor: "Tony Evers", governorParty: "D", houseSeats: 8, senators: ["Tammy Baldwin", "Ron Johnson"], senatorParties: ["D", "R"], minPopulation: 5_800_000 },
  { code: "WY", name: "Wyoming", governor: "Mark Gordon", governorParty: "R", houseSeats: 1, senators: ["John Barrasso", "Cynthia Lummis"], senatorParties: ["R", "R"], minPopulation: 570_000 },
];

/** Quick lookup by state code. */
export const STATE_REFERENCE_MAP = new Map(
  STATE_REFERENCE.map((s) => [s.code, s]),
);
