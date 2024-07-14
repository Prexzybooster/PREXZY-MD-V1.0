const { DataTypes } = require('sequelize');
const config = require('../../config');

const Vote = config.DATABASE.define('vote', {
    vote: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

exports.setVotes = async (votes) => {
    try {
        let voteObject = JSON.stringify(votes);
        const existingVote = await Vote.findOne({});
        if (!existingVote) {
            const newVote = { vote: voteObject };
            return await Vote.create(newVote);
        } else {
            const updatedVote = { vote: voteObject };
            await existingVote.update(updatedVote);
            return existingVote;
        }
    } catch (error) {
        console.error('Error setting votes:', error);
        throw error;
    }
};

exports.getVotes = async () => {
    try {
        const result = await Vote.findOne({});
        if (!result) {
            return {};
        }
        return JSON.parse(result.vote);
    } catch (error) {
        console.error('Error getting votes:', error);
        throw error;
    }
};
