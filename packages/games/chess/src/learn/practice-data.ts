// Made by tools/practice/generate.mts: do not edit by hand.
export type StarRound = { fen: string; star: string; answer: string };
export type CaptureRound = { fen: string; from: string; to: string };

export const PIECE_PRACTICE: Record<'P' | 'R' | 'B' | 'N' | 'Q' | 'K', { star: StarRound[]; capture: CaptureRound[] }> = {
  "P": {
    "star": [
      {
        "fen": "8/6K1/8/8/R6P/2k5/3R4/8 w - -",
        "star": "h5",
        "answer": "h4"
      },
      {
        "fen": "8/2N5/8/8/N5Pk/1K6/8/8 w - -",
        "star": "g5",
        "answer": "g4"
      },
      {
        "fen": "8/8/5k2/B2P4/8/3R4/1K6/8 w - -",
        "star": "d6",
        "answer": "d5"
      },
      {
        "fen": "8/8/6K1/2k5/8/8/2PR3N/8 w - -",
        "star": "c3",
        "answer": "c2"
      }
    ],
    "capture": [
      {
        "fen": "8/4n3/3P4/5b2/4k3/8/1K6/8 w - -",
        "from": "d6",
        "to": "e7"
      },
      {
        "fen": "8/7b/6P1/8/6k1/8/1K4bp/8 w - -",
        "from": "g6",
        "to": "h7"
      },
      {
        "fen": "5K2/8/4pb2/3P4/8/8/6k1/8 w - -",
        "from": "d5",
        "to": "e6"
      },
      {
        "fen": "8/8/5r2/6P1/1K2k3/8/5n2/r7 w - -",
        "from": "g5",
        "to": "f6"
      }
    ]
  },
  "R": {
    "star": [
      {
        "fen": "3B4/8/8/1K6/2P5/8/6k1/1R6 w - -",
        "star": "b3",
        "answer": "b1"
      },
      {
        "fen": "8/7P/8/8/K2k4/8/5R2/4B3 w - -",
        "star": "f4",
        "answer": "f2"
      },
      {
        "fen": "8/1k6/8/K7/2R5/8/7B/2B5 w - -",
        "star": "c8",
        "answer": "c4"
      },
      {
        "fen": "8/2B5/7k/2R2KN1/8/8/8/8 w - -",
        "star": "c3",
        "answer": "c5"
      }
    ],
    "capture": [
      {
        "fen": "8/8/4k3/6R1/8/3K4/1r2r1r1/8 w - -",
        "from": "g5",
        "to": "g2"
      },
      {
        "fen": "K6k/8/6R1/6n1/4n3/8/8/8 w - -",
        "from": "g6",
        "to": "g5"
      },
      {
        "fen": "8/k3p3/8/8/8/3p1R2/K7/8 w - -",
        "from": "f3",
        "to": "d3"
      },
      {
        "fen": "3r3R/8/8/2K5/k7/8/3n4/8 w - -",
        "from": "h8",
        "to": "d8"
      }
    ]
  },
  "B": {
    "star": [
      {
        "fen": "8/3N4/8/4P3/B7/8/K5k1/8 w - -",
        "star": "c2",
        "answer": "a4"
      },
      {
        "fen": "5Q2/3k4/P7/3K4/8/8/8/5B2 w - -",
        "star": "b5",
        "answer": "f1"
      },
      {
        "fen": "1K6/8/8/8/8/8/1B4k1/6NN w - -",
        "star": "h8",
        "answer": "b2"
      },
      {
        "fen": "1k6/4B3/8/8/6KP/8/8/7R w - -",
        "star": "a3",
        "answer": "e7"
      }
    ],
    "capture": [
      {
        "fen": "2k5/8/8/1n6/8/B3K3/1b6/8 w - -",
        "from": "a3",
        "to": "b2"
      },
      {
        "fen": "6B1/K7/8/1pnn4/8/k7/8/8 w - -",
        "from": "g8",
        "to": "d5"
      },
      {
        "fen": "1B6/8/1kpn4/8/8/1K6/6b1/8 w - -",
        "from": "b8",
        "to": "d6"
      },
      {
        "fen": "8/8/8/K2B4/5p2/8/8/4k2r w - -",
        "from": "d5",
        "to": "h1"
      }
    ]
  },
  "N": {
    "star": [
      {
        "fen": "8/8/5B2/8/3N4/K7/6k1/4R3 w - -",
        "star": "f5",
        "answer": "d4"
      },
      {
        "fen": "6K1/8/7P/8/8/k7/8/2N3B1 w - -",
        "star": "e2",
        "answer": "c1"
      },
      {
        "fen": "8/8/B3P3/1NK5/8/5k2/8/8 w - -",
        "star": "c7",
        "answer": "b5"
      },
      {
        "fen": "8/8/8/8/N3KQ2/5P2/8/k7 w - -",
        "star": "b2",
        "answer": "a4"
      }
    ],
    "capture": [
      {
        "fen": "8/7K/4p3/6k1/8/4p3/6N1/r7 w - -",
        "from": "g2",
        "to": "e3"
      },
      {
        "fen": "2N5/4n3/8/1k6/8/7n/4K3/6r1 w - -",
        "from": "c8",
        "to": "e7"
      },
      {
        "fen": "8/8/2r5/8/n7/8/1N1K4/6k1 w - -",
        "from": "b2",
        "to": "a4"
      },
      {
        "fen": "8/p6K/1k6/8/8/7n/2p2N2/8 w - -",
        "from": "f2",
        "to": "h3"
      }
    ]
  },
  "Q": {
    "star": [
      {
        "fen": "8/6P1/5k2/8/8/4PK2/8/2Q5 w - -",
        "star": "c6",
        "answer": "c1"
      },
      {
        "fen": "8/1k6/8/7Q/6N1/4R3/1K6/8 w - -",
        "star": "h7",
        "answer": "h5"
      },
      {
        "fen": "8/K1N5/8/7k/3Q4/8/8/B7 w - -",
        "star": "a4",
        "answer": "d4"
      },
      {
        "fen": "1N6/8/4P3/8/5K2/8/1k6/6Q1 w - -",
        "star": "b1",
        "answer": "g1"
      }
    ],
    "capture": [
      {
        "fen": "5K2/5Q1p/8/8/8/7b/8/1k2r3 w - -",
        "from": "f7",
        "to": "h7"
      },
      {
        "fen": "8/8/8/3nk2K/8/8/6r1/7Q w - -",
        "from": "h1",
        "to": "g2"
      },
      {
        "fen": "k7/8/8/1b2p3/8/4Q3/2K5/8 w - -",
        "from": "e3",
        "to": "e5"
      },
      {
        "fen": "8/8/5K2/8/4k3/1p6/4b3/4Q3 w - -",
        "from": "e1",
        "to": "e2"
      }
    ]
  },
  "K": {
    "star": [
      {
        "fen": "8/6B1/8/5K2/8/7R/8/4k3 w - -",
        "star": "e4",
        "answer": "f5"
      },
      {
        "fen": "8/8/8/k7/7B/8/7B/1K6 w - -",
        "star": "a2",
        "answer": "b1"
      },
      {
        "fen": "8/4N3/2P5/4K2k/8/8/8/8 w - -",
        "star": "f4",
        "answer": "e5"
      },
      {
        "fen": "5k2/8/8/8/1K6/5P2/4N3/8 w - -",
        "star": "c5",
        "answer": "b4"
      }
    ],
    "capture": [
      {
        "fen": "8/8/2k4r/8/8/8/1p2K3/3n4 w - -",
        "from": "e2",
        "to": "d1"
      },
      {
        "fen": "8/pK4k1/8/8/8/8/8/5n2 w - -",
        "from": "b7",
        "to": "a7"
      },
      {
        "fen": "8/8/1k6/8/6p1/8/5K2/4r3 w - -",
        "from": "f2",
        "to": "e1"
      },
      {
        "fen": "8/6n1/5k2/1n6/K7/8/6p1/8 w - -",
        "from": "a4",
        "to": "b5"
      }
    ]
  }
};
