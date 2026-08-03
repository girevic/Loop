// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Loop16 {
    uint8 public constant SOUNDS = 4;
    uint8 public constant STEPS = 16;
    uint8 public constant DAILY_LIMIT = 5;

    struct Profile {
        uint64 totalNotes;
        uint64 lastActiveDay;
        uint8 todayNotes;
        uint8 lastSound;
        uint8 lastStep;
        uint64 lastAddedAt;
    }

    mapping(address => Profile) private profiles;
    mapping(uint64 => uint32[64]) private dailyPatterns;

    uint64 public globalNotes;

    error InvalidSound();
    error InvalidStep();
    error DailyLimitReached();

    event NoteAdded(
        address indexed musician,
        uint64 indexed day,
        uint8 indexed sound,
        uint8 step,
        uint8 dailyNote,
        uint32 stepVotes,
        uint64 timestamp
    );

    function addNote(uint8 sound, uint8 step) external {
        if (sound >= SOUNDS) revert InvalidSound();
        if (step >= STEPS) revert InvalidStep();

        uint64 currentDay = uint64(block.timestamp / 1 days);
        Profile storage profile = profiles[msg.sender];

        if (profile.lastActiveDay != currentDay) {
            profile.lastActiveDay = currentDay;
            profile.todayNotes = 0;
        }

        if (profile.todayNotes >= DAILY_LIMIT) {
            revert DailyLimitReached();
        }

        uint8 patternIndex = sound * STEPS + step;
        uint32 stepVotes = dailyPatterns[currentDay][patternIndex] + 1;
        dailyPatterns[currentDay][patternIndex] = stepVotes;

        profile.totalNotes += 1;
        profile.todayNotes += 1;
        profile.lastSound = sound;
        profile.lastStep = step;
        profile.lastAddedAt = uint64(block.timestamp);
        globalNotes += 1;

        emit NoteAdded(
            msg.sender,
            currentDay,
            sound,
            step,
            profile.todayNotes,
            stepVotes,
            uint64(block.timestamp)
        );
    }

    function statsOf(
        address user
    ) external view returns (Profile memory stats) {
        stats = profiles[user];
        if (stats.lastActiveDay != uint64(block.timestamp / 1 days)) {
            stats.todayNotes = 0;
        }
    }

    function getDayPattern(
        uint64 day
    ) external view returns (uint32[64] memory pattern) {
        pattern = dailyPatterns[day];
    }
}
