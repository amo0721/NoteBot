const Discord = require('discord.js');
const fs = require('fs');

let TheToken = process.env.BotToken


const { Client, Util } = require('discord.js');
const PREFIX = "~"
const GOOGLE_API_KEY = "AIzaSyD5HkfjExwmv2HFDfS0zwAHdkrNNEmJcsw"
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const client = new Discord.Client();

client.login(TheToken)

client.on('ready', () => {
  client.guilds.array().forEach((eachGuild) => {
    if (eachGuild.voiceConnection) {
      eachGuild.voiceConnection.channel.leave()
    }
})
console.log('oKtHiSrEaDyLeTsDoThIsYaYhErOkUcAnHoStMuZiCbOt')
});

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Yo this ready!'));

client.on('disconnect', () => console.log('I just disconnected, making sure you know, I will reconnect now...'));

client.on('reconnecting', () => console.log('I am reconnecting now!'));

client.on('message', async msg => { // eslint-disable-line
	if (!msg.content.startsWith(PREFIX)) return undefined;
	console.log(`ohh`)

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length)

	if (command === '불러줘' || command === '플레이') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send(`${msg.author.username} 이 음성채널에 없습니다. \n음성채널에 들어간다음 다시 시도해 보세요.`);
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('그곳에 들어갈수 있는 권한이 없음..\n서버 설정에 역할에 들어가서 워터봇이 관리자 권한을 가지고 있는지 확인해주세요.');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('말하기 권한이 없어;; 노래좀 부르게 해줘..');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`✅ **${playlist.title}** 가 재생목록에 추가되었습니다!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**검색결과:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
1 - 10 을 입력하여 선택하시면 됩니다.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('시간초과 ㅅㄱ');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 음? 검색이 안됨..');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === '그만불러' || command === '스킵' || command === '닥쳐') {
		if (!msg.member.voiceChannel) return msg.channel.send('넌 내 노래를 듣고있지도 않은데 뭘 스킵이야');
		if (!serverQueue) return msg.channel.send('스킵할 노래가 없음;;');
		serverQueue.connection.dispatcher.end('쳇..');
		return undefined;
	} else if (command === '멈춰' || command === '초기화') {
		if (!msg.member.voiceChannel) return msg.channel.send('먼저 음성 채널에 들어가시죠');
		if (!serverQueue) return msg.channel.send('님한테 멈춰줄 노래가 없네요 ㅅㄱ');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('초기화됨!');
		return undefined;
	} else if (command === '볼륨') {
		if (!msg.member.voiceChannel) return msg.channel.send('음성 채널에 먼저 들어와!');
		if (!serverQueue) return msg.channel.send('부르고 있는 노래가 없어;;');
		if (!args[1]) return msg.channel.send(`현재 볼륨: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`볼륨 변경 완료! : **${args[1]}**`);
	} else if (command === '뭐부르고있음' || command === '지금' || command === '뭐임') {
		if (!serverQueue) return msg.channel.send('아무것도 안부름');
		return msg.channel.send(`🎶 지금 부르는거: **${serverQueue.songs[0].title}**`);
	} else if (command === '재생목록' || command === '뭐남음') {
		if (!serverQueue) return msg.channel.send('아무것도 안남음');
		return msg.channel.send(`
__**재생목록:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
**지금 부르는거:** ${serverQueue.songs[0].title}
		`);
	} else if (command === '일시정지' || command === '잠만') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ 일시정지됨!');
		}
		return msg.channel.send('잠깐 멈춰줄 노래가 없음');
	} else if (command === '다시불러') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶ ㅇㅋ 다시부름!');
		}
		return msg.channel.send('다시부를게 없네');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 0.5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`채널에 들어갈수 없음: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`채널에 들어갈수 없음: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`✅ **${song.title}** 가 재생목록에 추가되었습니다!`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶  **${song.title}** 부를게`);
}
