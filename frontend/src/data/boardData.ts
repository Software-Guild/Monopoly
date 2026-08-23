import type { BoardSpace, PropertySpace, RentTable } from "../types/game";

const rentFor = (price: number): RentTable => {
  const base = Math.max(2, Math.round(price / 12));
  return {
    base,
    monopoly: base * 2,
    house1: Math.round(price * 0.45),
    house2: Math.round(price * 1.35),
    house3: Math.round(price * 3.2),
    house4: Math.round(price * 4.1),
    hotel: Math.round(price * 5.2),
  };
};

const site = (id: number, name: string, shortName: string, state: string, groupColor: string, price: number, houseCost: number): PropertySpace => ({
  id,
  type: "property",
  propertyKind: "site",
  name,
  shortName,
  state,
  group: state,
  groupColor,
  price,
  mortgageValue: price / 2,
  houseCost,
  rent: rentFor(price),
});

const station = (id: number, name: string, shortName: string): PropertySpace => ({
  id,
  type: "property",
  propertyKind: "station",
  name,
  shortName,
  icon: "🚆",
  groupColor: "#526176",
  price: 200,
  mortgageValue: 100,
});

const utility = (id: number, name: string, icon: string): PropertySpace => ({
  id,
  type: "property",
  propertyKind: "utility",
  name,
  icon,
  groupColor: "#2b7d91",
  price: 150,
  mortgageValue: 75,
});

export const stateColors: Record<string, string> = {
  Goa: "#8a553f",
  Rajasthan: "#36a8ca",
  Kerala: "#d35a94",
  "West Bengal": "#e08a35",
  Gujarat: "#d64f4f",
  Maharashtra: "#e7b93c",
  Karnataka: "#48a86c",
  "Tamil Nadu": "#4668cc",
};

export const boardData: BoardSpace[] = [
  { id: 0, type: "start", name: "START", icon: "➤" },
  site(1, "Panaji", "Panaji", "Goa", stateColors.Goa, 60, 50),
  { id: 2, type: "treasure", name: "Treasure", icon: "🧰" },
  site(3, "Margao", "Margao", "Goa", stateColors.Goa, 60, 50),
  { id: 4, type: "tax", name: "Income Tax", amount: 200, icon: "₹" },
  station(5, "New Delhi Railway Station", "New Delhi"),
  site(6, "Jaipur", "Jaipur", "Rajasthan", stateColors.Rajasthan, 100, 50),
  { id: 7, type: "surprise", name: "Surprise", icon: "?" },
  site(8, "Jodhpur", "Jodhpur", "Rajasthan", stateColors.Rajasthan, 100, 50),
  site(9, "Udaipur", "Udaipur", "Rajasthan", stateColors.Rajasthan, 120, 50),
  { id: 10, type: "jail", name: "Jail / Just Visiting", shortName: "Jail", icon: "▥" },
  site(11, "Kochi", "Kochi", "Kerala", stateColors.Kerala, 140, 100),
  utility(12, "Power Company", "⚡"),
  site(13, "Kozhikode", "Kozhikode", "Kerala", stateColors.Kerala, 140, 100),
  site(14, "Thiruvananthapuram", "Trivandrum", "Kerala", stateColors.Kerala, 160, 100),
  station(15, "Howrah Junction", "Howrah"),
  site(16, "Kolkata", "Kolkata", "West Bengal", stateColors["West Bengal"], 180, 100),
  { id: 17, type: "treasure", name: "Treasure", icon: "🧰" },
  site(18, "Darjeeling", "Darjeeling", "West Bengal", stateColors["West Bengal"], 180, 100),
  site(19, "Siliguri", "Siliguri", "West Bengal", stateColors["West Bengal"], 200, 100),
  { id: 20, type: "vacation", name: "Vacation", icon: "🏝️" },
  site(21, "Ahmedabad", "Ahmedabad", "Gujarat", stateColors.Gujarat, 220, 150),
  { id: 22, type: "surprise", name: "Surprise", icon: "?" },
  site(23, "Surat", "Surat", "Gujarat", stateColors.Gujarat, 220, 150),
  site(24, "Vadodara", "Vadodara", "Gujarat", stateColors.Gujarat, 240, 150),
  station(25, "Chhatrapati Shivaji Maharaj Terminus", "CSMT"),
  site(26, "Mumbai", "Mumbai", "Maharashtra", stateColors.Maharashtra, 260, 150),
  site(27, "Pune", "Pune", "Maharashtra", stateColors.Maharashtra, 260, 150),
  utility(28, "Water Company", "💧"),
  site(29, "Nagpur", "Nagpur", "Maharashtra", stateColors.Maharashtra, 280, 150),
  { id: 30, type: "goToJail", name: "Go To Jail", icon: "⚠" },
  site(31, "Bengaluru", "Bengaluru", "Karnataka", stateColors.Karnataka, 300, 200),
  site(32, "Mysuru", "Mysuru", "Karnataka", stateColors.Karnataka, 300, 200),
  { id: 33, type: "treasure", name: "Treasure", icon: "🧰" },
  site(34, "Mangaluru", "Mangaluru", "Karnataka", stateColors.Karnataka, 320, 200),
  station(35, "Chennai Central", "Chennai Central"),
  { id: 36, type: "surprise", name: "Surprise", icon: "?" },
  site(37, "Chennai", "Chennai", "Tamil Nadu", stateColors["Tamil Nadu"], 350, 200),
  { id: 38, type: "tax", name: "Luxury Tax", amount: 100, icon: "₹" },
  site(39, "Coimbatore", "Coimbatore", "Tamil Nadu", stateColors["Tamil Nadu"], 400, 200),
];

export const purchasableSpaces = boardData.filter((space): space is PropertySpace => space.type === "property");

export const getSpace = (id: number): BoardSpace => boardData[id];
