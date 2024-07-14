async function bindGroupMetadata(manager) {
    const groupMetadata = {};

    const isLoading = {
        true: true,
        false: false
    };

    const fetchGroupMetadata = async (groupId) => {
        return new Promise(async (resolve, reject) => {
            if (!groupMetadata[groupId] || !groupMetadata[groupId].participants) {
                if (!isLoading[groupId]) {
                    try {
                        resolve(groupMetadata[groupId]);
                    } catch (error) {
                        console.error(error);
                    }
                } else {
                    const interval = setInterval(() => {
                        if (!isLoading[groupId]) {
                            clearInterval(interval);
                            resolve(groupMetadata[groupId]);
                        }
                    }, 500);
                }
            } else {
                resolve(groupMetadata[groupId]);
            }
        });
    };

    manager.ev.on('groups.update', async updates => {
        for (const update of updates) {
            const group = await fetchGroupMetadata(update.id);
            if (group) {
                Object.assign(group, update);
            }
        }
    });

    manager.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action === 'remove' && participants.includes(manager.user.jid)) {
            delete groupMetadata[id];
        }

        let group = await fetchGroupMetadata(id);
        if (group) {
            switch (action) {
                case 'add':
                    group.participants.push(...participants.map(participant => ({
                        id: participant,
                        admin: null
                    })));
                    break;
                case 'demote':
                case 'promote':
                    for (const participant of group.participants) {
                        if (participants.includes(participant.id)) {
                            participant.admin = action === 'promote' ? 'admin' : null;
                        }
                    }
                    break;
                case 'remove':
                    group.participants = group.participants.filter(participant => !participants.includes(participant.id));
                    break;
            }
            group.size = group.participants.length;
        }
    });

    return {
        groupMetadata,
        fetchGroupMetadata,
        active: false
    };
}
exports.bind = bindGroupMetadata;