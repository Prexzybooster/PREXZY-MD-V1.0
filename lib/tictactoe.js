const { setDb } = require('./db/store');
const { PREFIX } = require('./utils');

const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const stripDomain = (jid) => jid.split('@')[0];

const symbols = {
    X: '❌',
    O: '⭕',
    1: '1️⃣',
    2: '2️⃣',
    3: '3️⃣',
    4: '4️⃣',
    5: '5️⃣',
    6: '6️⃣',
    7: '7️⃣',
    8: '8️⃣',
    9: '9️⃣'
};

const createBoard = () => Array(9).fill(undefined);
const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

const isWinningCombination = (board) => {
    for (const combo of winningCombinations) {
        const [a, b, c] = combo;
        if (board[a] === board[b] && board[b] === board[c] && board[a]) {
            return true;
        }
    }
    return false;
};

const createRestartButton = (gameId, message) => {
    const button = {
        buttonId: `${PREFIX}tictactoe ${gameId}`,
        buttonText: { displayText: 'Restart Game' },
        type: 1
    };

    return {
        contentText: message,
        buttons: [button],
        headerType: 1
    };
};

const formatBoard = (board) => {
    const formatted = board.map((cell, i) => symbols[cell] || symbols[i + 1]);
    return `${formatted.slice(0, 3).join('')}\n${formatted.slice(3, 6).join('')}\n${formatted.slice(6).join('')}`;
};

const gameMessage = (playerX, playerO, currentPlayer) => (
    `---Tic Tac Toe---\n\nPlayers\n${symbols.X} : @${playerX}\n${symbols.O} : @${playerO}\n\n` +
    `currentPlayer : @${currentPlayer}\n\n${formatBoard(db.game.room.tic)}`
);

const encodeKey = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('./test/test');
const isValidKey = iChecker() === encodeKey;

if (isValidKey) {
    exports.ticTacToe = async (gameId, playerX, playerO) => {
        if (db.game.state && playerO) {
            exports.deleteTicTacToe();
        }

        if (!db.game.state && playerO) {
            const players = [playerX, playerO];
            const room = {
                X: playerX,
                O: playerO,
                tic: createBoard(),
                currentPlayer: randomElement(players),
                players,
                tac: createBoard(),
                id: gameId
            };

            db.game.room = room;
            db.game.state = true;
            await setDb();

            return {
                text: gameMessage(stripDomain(room.X), stripDomain(room.O), stripDomain(room.currentPlayer)),
                code: 200
            };
        }
        return false;
    };
}

exports.isTicTacToe = async (position, gameId, player) => {
    if (!db.game.state || !db.game.room.players.includes(player) || db.game.room.id !== gameId || db.game.room.currentPlayer !== player || isNaN(position)) {
        return { code: 404, text: '' };
    }

    position = position.charAt(0) - 1;
    if (db.game.room.tic[position] === 'X' || db.game.room.tic[position] === 'O') {
        return { text: '_Already Occupied_', code: 300 };
    }

    db.game.room.tic[position] = db.game.room.X === player ? 'X' : 'O';
    db.game.room.tac[position] = db.game.room.X === player ? 'X' : 'O';

    if (isWinningCombination(db.game.room.tac)) {
        const winner = db.game.room.currentPlayer !== db.game.room.O ? db.game.room.X : db.game.room.O;
        const loser = db.game.room.currentPlayer !== db.game.room.O ? db.game.room.O : db.game.room.X;
        const result = [winner, loser, gameMessage(stripDomain(db.game.room.X), stripDomain(db.game.room.O)), db.game.room.O];
        
        db.game.state = false;
        db.game.room = {};
        await setDb();

        return { text: result, code: 201 };
    }

    if (db.game.room.tac.filter((cell) => !cell).length === 0) {
        const result = [db.game.room.O, db.game.room.X, gameMessage(stripDomain(db.game.room.X), stripDomain(db.game.room.O)), db.game.room.O];
        
        db.game.state = false;
        db.game.room = {};
        await setDb();

        return { text: result, code: 403 };
    }

    db.game.room.currentPlayer = db.game.room.X === player ? db.game.room.O : db.game.room.X;
    await setDb();

    return {
        text: [db.game.room.O, db.game.room.X, gameMessage(stripDomain(db.game.room.X), stripDomain(db.game.room.O), db.game.room.currentPlayer), db.game.room.O],
        code: 301
    };
};

exports.isGameActive = () => {
    const gameText = db.game.state ? gameMessage(stripDomain(db.game.room.X), stripDomain(db.game.room.O), stripDomain(db.game.room.currentPlayer)) : '';
    return {
        state: db.game.state,
        mentionedJid: [db.game.room.X, db.game.room.O],
        text: gameText
    };
};

exports.deleteTicTacToe = async () => {
    if (db.game.state) {
        db.game.room = {};
        db.game.state = false;
        await setDb();
        return true;
    }
};