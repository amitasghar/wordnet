# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-09-category-generation-system/spec.md

> Created: 2025-09-09
> Version: 1.0.0

## Schema Changes

### Category Data Structure
```json
{
  "categories": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "difficulty": "number (1-5)",
      "tags": ["array of strings"],
      "letterCompatibility": {
        "preferred": ["array of letters"],
        "avoided": ["array of letters"],
        "impossible": ["array of letters"]
      },
      "metadata": {
        "created": "ISO date string",
        "popularity": "number",
        "successRate": "number (0-1)"
      }
    }
  ]
}
```

### Letter Frequency and Difficulty Mappings
```json
{
  "letterData": {
    "frequencies": {
      "A": 8.12,
      "B": 1.49,
      "C": 2.78,
      "D": 4.25,
      "E": 12.02,
      "F": 2.23,
      "G": 2.02,
      "H": 6.09,
      "I": 6.97,
      "J": 0.15,
      "K": 0.77,
      "L": 4.03,
      "M": 2.41,
      "N": 6.75,
      "O": 7.51,
      "P": 1.93,
      "Q": 0.10,
      "R": 5.99,
      "S": 6.33,
      "T": 9.06,
      "U": 2.76,
      "V": 0.98,
      "W": 2.36,
      "X": 0.15,
      "Y": 1.97,
      "Z": 0.07
    },
    "difficultyRatings": {
      "easy": ["E", "A", "R", "I", "O", "T", "N", "S"],
      "medium": ["L", "C", "U", "D", "P", "M", "H", "G", "B", "F", "Y", "W", "K", "V"],
      "hard": ["X", "J", "Q", "Z"]
    }
  }
}
```

### Round Configuration Storage
```json
{
  "roundConfigurations": {
    "default": {
      "duration": 90,
      "difficultyProgression": "balanced",
      "categoryWeighting": "equal",
      "letterSelection": "frequency-based"
    },
    "quick": {
      "duration": 60,
      "difficultyProgression": "easy-start",
      "categoryWeighting": "popular-first",
      "letterSelection": "common-letters"
    },
    "challenge": {
      "duration": 90,
      "difficultyProgression": "hard-bias",
      "categoryWeighting": "variety-focused",
      "letterSelection": "balanced-distribution"
    }
  }
}
```

### Game State Integration
```json
{
  "currentRound": {
    "id": "string",
    "category": "Category object",
    "letter": "string",
    "startTime": "ISO date string",
    "duration": "number (seconds)",
    "configuration": "string (config key)",
    "generationTime": "number (milliseconds)"
  }
}
```

## Migrations

### Initial Schema Setup
- Create categories.json with initial category database
- Implement letterData.json with frequency and difficulty mappings
- Set up roundConfigurations.json with default game modes
- Initialize data validation schemas for all structures

### Data Population
- Import initial category set covering common themes
- Calibrate difficulty ratings based on word availability
- Configure letter compatibility rules for each category
- Set up default round configurations for different play styles

### Integration Points
- Extend existing game state to include category/letter data
- Modify WordDataManager to support category-filtered word lookups
- Update game flow to incorporate generation system
- Add performance monitoring for generation timing