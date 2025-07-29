// server.js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
console.log("WebSocket 서버 시작됨: ws://localhost:8080");

const MAX_PLAYERS = 2;
let players = new Array(MAX_PLAYERS).fill(null); // [null, null]

let blocks = generateBlocks();
let gameStarted = false;

function generateBlocks(){
  const blocks = [];
  const rows = 4;
  const cols = 8;
   const colIndices = Array.from({length: cols}, (_, i) => i);

  for (let r = 0; r < rows; r++) {
    const blockCount = Math.floor(Math.random() * 4) + 2;
    const chosenCols = colIndices.sort(() => Math.random() - 0.5).slice(0, blockCount);

    for (let c of chosenCols) {
      let hp = Math.floor(Math.random() * 3) + 1;
      blocks.push({ x: 70 * c + 35, y: 40 * r + 40, hp });
    }
  }
  return blocks;
}

function addBlockRow() {
  const cols = 8;
  const colIndices = Array.from({ length: cols }, (_, i) => i);

  const blockCount = Math.floor(Math.random() * 3) + 1;
  const chosenCols = colIndices.sort(() => Math.random() - 0.5).slice(0, blockCount);

  const newRow = [];

  for (let c of chosenCols) {
    let hp = Math.floor(Math.random() * 3) + 1;
    newRow.push({ x: 70 * c + 35, y: 40, hp });
  }

  return newRow;
}


wss.on('connection', (ws) => {
  const index = players.findIndex(p => p === null);
  if (index === -1) {
    ws.send(JSON.stringify({ type: "error", message: "최대 2명까지만 접속 가능합니다." }));
    ws.close();
    return;
  }

  const playerId = `player${index + 1}`;
  players[index] = { id: playerId, ws, ready: false };

  ws.send(JSON.stringify({ type: 'assign_id', playerId }));
  ws.send(JSON.stringify({ type: 'init_blocks', blocks }));

  console.log(`🔗 ${playerId} 연결됨`);


  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'paddle_update') {
        // 상대방에게만 전달
        players.forEach(p => {
          if (p && p.ws !== ws && p.ws.readyState === 1) {
            p.ws.send(JSON.stringify({
              type: 'opponent_paddle',
              playerId: data.playerId,
              x: data.x,
              angle: data.angle
            }));
          }
        });
      } else if (data.type === 'ball_position'){
        players.forEach(p => {
          if(p.ws !== ws && p.ws.readyState === 1){
            p.ws.send(JSON.stringify({
              type: 'ball_position',
              data: data.data
            }))
          }
        })
      } else if (data.type === 'blocks_update'){
        blocks = data.blocks.map(b => ({ x: b.x, y: b.y, hp: b.hp }));

        players.forEach(p => {
          if(p.ws !== ws && p.ws.readyState === 1){
            p.ws.send(JSON.stringify({
              type: 'blocks_update',
              data: data.blocks
            }))
          }
        })
      }else if (data.type === 'player_ready'){
        const player = players.find(p => p.id === data.playerId);
        if (player) {
          player.ready = true;


          // 두 플레이어가 모두 준비됐는지 확인
          if (players.filter(p => p !== null).length === 2 &&
              players.every(p => p && p.ready)) {
            gameStarted = true;

            players.forEach(p => {
              if (p && p.ws.readyState === 1) {
                p.ws.send(JSON.stringify({ type: "start_game" }));
              }
            });
          }
        }
      }
    } catch (err) {
      console.error("메시지 파싱 실패:", err);
    }
  });

  ws.on('close', () => {
    console.log(`${playerId} 연결 해제`);
    players[index] = null;

    if (players.every(p => p === null)) {
      gameStarted = false;
    }
  });
});

setInterval(() => {
  if(!gameStarted) return;

  const newRow = addBlockRow();
  console.log("새로운 블록 줄 추가됨:", newRow); // 추가

  // 기존 블록들을 아래로 이동
  blocks.forEach(b => b.y += 40);
  blocks.push(...newRow);

  players.forEach(p => {
    if (p && p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({
        type: 'block_add',
        newRow
      }));
    }
  });
}, 8000); // 8초 주기
