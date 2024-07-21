const mask = require("../Utilis/events")
mask.addCommand(
  {
    pattern: "lstonline ?(.*)",
    fromMe: true,
    desc: "list Online",
  },
  async (message, match) => {
    const online = [...Object.keys(await message.client.chats.get(message.jid).presences), message.client.user.jid]
    await message.sendMessage(
      "*List Online*\n\n" + online.map((e) => "@" + e.split("@")[0]).join("\n"),
      { contextInfo: { mentionedJid: online } }
    )
  }
) //Special thanks to lyfe
  //Stealed by mask ser
