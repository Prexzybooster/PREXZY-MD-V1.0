const { prepareWAMessageMedia } = require('baileys');
const alphabet = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
const cleanId = (id = '') => id.replace('@s.whatsapp.net', '');
const utils = require('./utils');

function createPlayer(id) {
    return {
        id,
        longest_word: '',
        word_count: 0,
        letter_count: 0
    };
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const getDifficulty = (isHard) => isHard ? 'hard' : 'easy';

exports.wordChainGame = {
    session: '',
    room: {},
    
    bind(session) {
        this.session = session;
    },

    end(gameId, creatorId) {
        if (!this.room[gameId] || this.room[gameId].creator !== creatorId) return;
        this.room[gameId].state = -1;
        delete this.room[gameId];
        const endMessage = { text: 'Game Ends' };
        this.session.sendMessage(gameId, endMessage, {
            ephemeralExpiration: utils.expiration[gameId],
            cachedGroupMetadata: utils.store.fetchGroupMetadata
        });
    },

    quit(gameId, playerId) {
        if (this.room[gameId].state !== 0 || !this.room[gameId].players[playerId]) return;
        delete this.room[gameId].players[playerId];
        this.room[gameId].participants = this.room[gameId].participants.filter(p => p !== playerId);
    },

    getCharacter(gameId, word) {
        const letter = this.room[gameId].mode === 'random' ? 
            alphabet[Math.round(Math.random() * alphabet.length)] || 'L' : 
            word.charAt(word.length - 1).toUpperCase();
        this.room[gameId].current.letter = letter;
    },

    async startGame(gameId, creatorId, mode, difficulty = 'easy') {
        if (gameId in this.room) return;

        const gameSettings = {
            player: '',
            size: 3,
            time: 40,
            next: '',
            letter: ''
        };

        this.room[gameId] = {
            mode: mode,
            creator: creatorId,
            state: 0,
            paused: false,
            used: [],
            players: {},
            joined: 0,
            time: 59,
            words: 0,
            round: 0,
            i: 0,
            cooldown: 40,
            participants: [],
            current: gameSettings
        };

        await this.main(gameId, creatorId);
    },

    isWordValid(word) {
        return this.ie.isWord(word.toLowerCase());
    },

    async checkWord(gameId, playerId, word, message) {
        if (!(gameId in this.room) || this.room[gameId].state !== 1 || this.room[gameId].current.player !== playerId || !this.room[gameId].participants.includes(playerId)) {
            return false;
        }
        if (this.room[gameId].paused) return;

        word = word.toLowerCase();

        if (this.room[gameId].used.includes(word)) {
            return this.sendMessage(gameId, { text: '_Already Used this Word!_' }, message);
        }

        if (word.charAt(0).toUpperCase() !== this.room[gameId].current.letter) {
            return this.sendMessage(gameId, { text: `_Not Starting with ${this.room[gameId].current.letter}_` }, message);
        }

        if (word.length < this.room[gameId].current.size) {
            return this.sendMessage(gameId, { text: `_This word is too short. It must be at least ${this.room[gameId].current.size} letters long._` }, message);
        }

        if (!this.isWordValid(word)) {
            return this.sendMessage(gameId, { text: '_This word is not in my word list_' }, message);
        }

        this.room[gameId].paused = true;
        this.room[gameId].current.time = this.room[gameId].cooldown;
        this.room[gameId].used.push(word);
        this.room[gameId].words++;

        this.getCharacter(gameId, word);
        this.room[gameId].players[playerId].word_count++;

        if (word.length > this.room[gameId].players[playerId].letter_count) {
            this.room[gameId].players[playerId].longest_word = word;
            this.room[gameId].players[playerId].letter_count = word.length;
        }

        await this.nextTurn(gameId);
        await prepareWAMessageMedia.delay(200);
        await this.sendMessage(gameId, { react: { text: '\u2705', key: message.key } });
        return true;
    },

    async nextTurn(gameId) {
        if (!this.room[gameId]) return;

        if (this.room[gameId].i <= 0) {
            this.room[gameId].i = this.room[gameId].participants.length;

            if (this.room[gameId].mode === 'hard' && this.room[gameId].current.size < 13) {
                this.room[gameId].current.size++;
            } else if (this.room[gameId].round % 3 === 0 && this.room[gameId].current.size < 13) {
                this.room[gameId].current.size++;
            }

            if (this.room[gameId].mode === 'hard' && this.room[gameId].cooldown > 20) {
                this.room[gameId].cooldown -= 5;
            } else if (this.room[gameId].cooldown > 20 && this.room[gameId].round % 4 === 0) {
                this.room[gameId].cooldown -= 5;
            }

            this.room[gameId].round++;
        }

        this.room[gameId].i--;
        this.room[gameId].current.time = this.room[gameId].cooldown;
        this.room[gameId].current.player = this.room[gameId].participants[0];
        this.room[gameId].current.next = this.room[gameId].participants[1];
        this.room[gameId].participants.push(this.room[gameId].participants.shift());

        await this.sendMessage(gameId, {
            text: `🎲 Turn : @${cleanId(this.room[gameId].current.player)}\n🙌 Next : @${cleanId(this.room[gameId].current.next)}\n📝 Your word must start with *${this.room[gameId].current.letter}* and be at least ${this.room[gameId].current.size} letters\n🏆 Players remaining : ${this.room[gameId].participants.length}/${this.room[gameId].joined}\n⏳ You have *${this.room[gameId].current.time}s* to answer\n📝 Total words: ${this.room[gameId].words}`,
            mentions: [this.room[gameId].current.player, this.room[gameId].current.next]
        }, {
            cachedGroupMetadata: utils.store.fetchGroupMetadata,
            ephemeralExpiration: utils.expiration[gameId]
        });

        this.room[gameId].paused = false;
    },

    async main(gameId, creatorId) {
        if (!this.room[gameId]) return;

        this.room[gameId].participants = shuffleArray(this.room[gameId].participants);
        this.room[gameId].current.letter = alphabet[Math.round(Math.random() * alphabet.length)] || 'L';
        this.room[gameId].i = this.room[gameId].participants.length;

        await this.nextTurn(gameId);

while (this.room[gameId].state === 1) {
    await prepareWAMessageMedia.delay(1000);

    if (!this.session) {
        continue;
    }

    this.room[gameId].current.time--;

    const participantCount = this.room[gameId].participants.length;
    const currentPlayer = this.room[gameId].current.player;
    const nextPlayer = this.room[gameId].current.next;

    if (this.room[gameId].current.time < 0) {
        this.room[gameId].participants = this.room[gameId].participants.filter(p => p !== currentPlayer);

        await this.session.sendMessage(gameId, {
            text: `@${cleanId(currentPlayer)} ran out of time! They're out! 🚫`,
            mentions: [currentPlayer]
        }, {
            ephemeralExpiration: utils.expiration[gameId],
            cachedGroupMetadata: utils.store.fetchGroupMetadata
        });

        if (participantCount === 2) {
            const totalTime = Math.round(new Date().getTime() / 1000 - this.room[gameId].start / 1000);
            const players = Object.values(this.room[gameId].players);
            const longestWordPlayer = players.reduce((max, player) => player.letter_count > max.letter_count ? player : max, players[0]);

            this.room[gameId].state = -1;

            await this.session.sendMessage(gameId, {
                text: `@${cleanId(nextPlayer)} Won 🏆\nWords: *${this.room[gameId].words}*\nLongest word: *${longestWordPlayer.longest_word} (${longestWordPlayer.letter_count})* by @${cleanId(longestWordPlayer.id)} ??\nTime: *${totalTime}s* ⏱️`,
                mentions: [nextPlayer, longestWordPlayer.id]
            }, {
                ephemeralExpiration: utils.expiration[gameId],
                cachedGroupMetadata: utils.store.fetchGroupMetadata
            });

            delete this.room[gameId];
            return;
        }

        await this.nextTurn(gameId);
    }
}
    }}