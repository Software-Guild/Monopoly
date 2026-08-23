import type { GameCard } from "../types/game";

export const treasureCards: GameCard[] = [
  { id: "t1", deck: "treasure", type: "money", title: "Festival Bonus", text: "Collect ₹100 from the Bank.", amount: 100 },
  { id: "t2", deck: "treasure", type: "money", title: "School Fees", text: "Pay ₹50 to the Bank.", amount: -50 },
  { id: "t3", deck: "treasure", type: "move", title: "Homeward Bound", text: "Advance to START and collect ₹200.", target: 0 },
  { id: "t4", deck: "treasure", type: "getOutOfJail", title: "Official Pardon", text: "Keep this card until needed or trade it.", },
  { id: "t5", deck: "treasure", type: "money", title: "Tax Refund", text: "Collect ₹50 from the Bank.", amount: 50 },
  { id: "t6", deck: "treasure", type: "jail", title: "Court Summons", text: "Go directly to Jail. Do not collect ₹200." },
];

export const surpriseCards: GameCard[] = [
  { id: "s1", deck: "surprise", type: "move", title: "Capital Calling", text: "Advance to New Delhi Railway Station.", target: 5 },
  { id: "s2", deck: "surprise", type: "money", title: "Traffic Fine", text: "Pay ₹25 to the Bank.", amount: -25 },
  { id: "s3", deck: "surprise", type: "money", title: "Startup Dividend", text: "Collect ₹150 from the Bank.", amount: 150 },
  { id: "s4", deck: "surprise", type: "getOutOfJail", title: "Official Pardon", text: "Keep this card until needed or trade it." },
  { id: "s5", deck: "surprise", type: "jail", title: "Go Directly to Jail", text: "Do not pass START. Do not collect ₹200." },
  { id: "s6", deck: "surprise", type: "move", title: "Southern Express", text: "Advance to Chennai.", target: 37 },
];

export const drawCard = (deck: "treasure" | "surprise"): GameCard => {
  const cards = deck === "treasure" ? treasureCards : surpriseCards;
  return cards[Math.floor(Math.random() * cards.length)];
};
