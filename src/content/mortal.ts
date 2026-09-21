import {z} from 'zod';
export const places=[['location.market','青溪集','告示、工作与来往消息'],['location.inn','河埠客舍','食宿、休息与收信'],['location.pharmacy','清禾药铺','辨药、炮制与照护'],['location.garden','青竹药园','雨前收成与异常药畦'],['location.pavilion','听雨亭','练习、合奏与江上曲'],['location.teahouse','临水茶社','短演、茶客与邀约'],['location.study','县学书院','抄录、访谈与水道考'],['location.workshop','河东作坊','修补旧物与材料取舍'],['location.mountain','云岫山道','有准备的出行'],['location.temple','松风旧观','观测、验证与初修']].map(([id,name,description])=>({id,name,description}));
export const backgrounds=[{id:'traveller',name:'普通旅人',tool:'个人包袱',skill:null},{id:'herbalist',name:'乡间采药者',tool:'旧药篓',skill:'medicine'},{id:'artisan',name:'工坊学徒',tool:'修补工具',skill:'craft'},{id:'scribe',name:'抄书人',tool:'笔具',skill:'scholar'},{id:'musician',name:'学曲者',tool:'普通竹笛',skill:'music'}] as const;
export const roles=[
 ['R01','客舍经营者','location.inn','经营客舍，按约收款'],['R02','用工介绍人','location.market','帮助店家找到人手'],['R03','药铺师傅','location.pharmacy','培养能独当一面的药工'],['R04','药园学徒','location.garden','独立承担药畦工作'],['R05','作坊匠人','location.workshop','保留旧物，按约交工'],['R06','游学书生','location.study','查清旧水道的来历'],['R07','行家乐师','location.pavilion','完成江上曲，再赴下游'],['R08','山脚采药人','location.mountain','采药谋生，平安回家'],['R09','过路行商','location.market','交付货物后回乡'],['R10','游方医者','location.temple','寻药并交流修持经验'],['R11','招募办事人','location.study','讲清公开基础课的责任'],['R12','镇上居民','location.pharmacy','照顾身体与家中事务']
].map(([id,name,location,goal])=>({id,name,location,goal,visitor:['R07','R09','R10','R11'].includes(id),skill:['R03','R05','R07','R10'].includes(id)?45:18}));
const Choice=z.object({id:z.string(),text:z.string(),detail:z.string(),cost:z.number().int().nonnegative(),minutes:z.number().int().positive(),reward:z.number().int().nonnegative()}).strict();
const Stage=z.object({name:z.string(),text:z.string(),choices:z.array(Choice).min(2)}).strict();
const Chain=z.object({id:z.string(),name:z.string(),location:z.string(),role:z.string().nullable(),skill:z.string().nullable(),requires:z.array(z.string()),stages:z.array(Stage).min(2),work:z.string().nullable()}).strict();
export type ChapterChain=z.infer<typeof Chain>;
const choice=(id:string,text:string,detail:string,minutes=120,cost=0,reward=0)=>({id,text,detail,minutes,cost,reward});
const stage=(name:string,text:string,a:ReturnType<typeof choice>,b:ReturnType<typeof choice>)=>({name,text,choices:[a,b]});
export const chains:ChapterChain[]=[
 {id:'CH01',name:'初到青溪',location:'location.market',role:'R02',skill:null,requires:[],work:null,stages:[
 stage('集口告示','渡船把你放在青溪岸边。包袱还在，下一顿饭和今夜的住处还没有着落。告示上写着客舍搬柴、药铺整篓和茶社清扫。',choice('notice','先看公开告示','记下三处工作，不收介绍费。',20),choice('ask','询问住处','问路者指向河埠客舍；并不自动签约。',20)),
 stage('今夜落脚','客舍的铺位与包食宿帮工都明码标价。选择一种暂时落脚的办法。',choice('rent','支付两日铺位','4 文；只付床位，现有干粮抵饮食。',20,4),choice('relief','包食宿帮工','劳动六小时，6 文和两日食宿；七日内一次。',360,0,6)),
 stage('第一份工','扫净院子、把药篓分门别类，都是能做好的事情。',choice('work','完成公共短工','劳动六小时，得 12 文。',360,0,12),choice('light','做低强度整理','劳动六小时，得 8 文；适合身体不适时。',360,0,8))]},
 {id:'CH02',name:'药篓里的两种叶子',location:'location.pharmacy',role:'R03',skill:'medicine',requires:['CH01'],work:'常用药册与康复记录',stages:[
 stage('相似叶片','两捆叶子形状很像。师傅问：你凭什么把它们放进同一格？',choice('ask','请药师指点','支付 4 文，占用药师两小时；记住叶脉区别。',120,4),choice('atlas','比对公开图册','多花时间，独立确认一种常用药。',180)),
 stage('合格药包','认识药材之后才谈炮制。药铺借出设施，材料按实际采购结算。',choice('process','分批炮制','材料 4 文；成品归药铺，验收支付 18 文。',240,4,18),choice('assist','交回疑难批次，协助整理','不冒险用药，少拿报酬；仍留下合格部分。',240,0,8)),
 stage('一次照护','患者需要知道什么时候服用、什么时候停止。普通照护有自己的边界。',choice('care','完成照护并记录','三小时，保留匿名病案与药册；普通医药不延寿。',180),choice('handover','写明用法，交接给药工','先确认交接再离开，同样留下服务记录。',120))]},
 {id:'CH03',name:'雨前的药畦',location:'location.garden',role:'R04',skill:null,requires:['CH01'],work:null,stages:[
 stage('萎叶一角','雨还没到，一小片叶子已经贴向同一个方向。先处理能解释的水土问题。',choice('inspect','按公开农书检查','半日检查排水与虫害；留下普通原因记录。',180),choice('help','请有经验的药工','支付 4 文，一同核查。',90,4)),
 stage('雨前采收','接下这次采收，就是承诺亲自来。若取消，未发出的报酬退回委托方。',choice('harvest','按顺序收下药材','三小时，支付 14 文；异常位置留下线索。',180,0,14),choice('drain','修整排水后采收','材料 2 文，支付 16 文；留下相同观察线索。',180,2,16)),
 stage('仍有异常','普通原因排除了，叶尖依旧随着旧观的钟声偏转。',choice('record','记下位置与时段','线索可供日后观息验证。',60),choice('refer','交给药工留意','暂缓亲自调查，记录依旧保留。',30))]},
 {id:'CH04',name:'一张旧琴',location:'location.workshop',role:'R05',skill:'craft',requires:['CH01'],work:'旧琴修复与验收记录',stages:[
 stage('先问物主','琴腹有裂，旧木上留着前人的手迹。物主在乎的不只是声音。',choice('preserve','询问纪念价值，保留原木','明确修复授权；琴仍属于物主。',120),choice('replace','征求同意后换料','讲清换料会改变声音，再取得授权。',90)),
 stage('动手修补','先前的授权决定了处理方式，材料在开工时消耗。',choice('repair','按授权试修','采购材料 4 文，完成后收 18 文。',240,4,18),choice('basic','做维护，疑难交师傅','不虚假承诺，收 8 文；仍有独立完成的维护记录。',180,0,8)),
 stage('交付旧琴','让物主亲自试音。旧痕是否留下，按先前约定验收。',choice('deliver','验收并归还','结清工具和旧琴，留下修理成果。',90),choice('recheck','复核后交付','多花时间确认，保留长期维修渠道。',150))]},
 {id:'CH05',name:'江上曲未尽',location:'location.pavilion',role:'R07',skill:'music',requires:['CH01'],work:'江上曲',stages:[
 stage('听曲相识','乐师说末尾不是忘了。那年船到这里，人还没有等来。',choice('lesson','约一次技巧练习','4 文；乐师的指导有限，离开后可独练。',120,4),choice('listen','听曲，抄下公开习谱','借用亭中普通乐器练节拍，不强制拜师。',180)),
 stage('寻一段江声','曲段可以从江声里来，也可以让那一拍空着。',choice('field','沿岸采风，整理自己的尾声','留下有出处的改编记录。',180),choice('archive','查旧谱，保留残曲的停顿','明确原曲与自己补订的部分。',180)),
 stage('完成一首曲','作品首先属于自己的生活。赚钱可以另约短演。',choice('private','独自成曲，私下试奏','完整作品计为凡人成果。',180),choice('perform','整理后做一次短演','茶社支付 12 文，演出只结算一次。',240,0,12))]},
 {id:'CH06',name:'县志里的旧水道',location:'location.study',role:'R06',skill:'scholar',requires:['CH01'],work:'青溪水道考',stages:[
 stage('年代矛盾','两种县志把同一场大水记在不同年份。不能把推测写成事实。',choice('versions','比对两种馆藏记录','公开借阅，记录来源。',180),choice('interview','访谈并核对旧记','保存相识者的口述与不确定处。',180)),
 stage('实地观察','沿河寻找旧石标，把见到的和听到的分开。',choice('observe','完成岸边观察','安全的城内路线，不强制战斗。',180),choice('records','核对测绘与水位旧录','不能亲自确认的部分明确标注。',240)),
 stage('成文与质疑','有用的资料并不总要导向确定的答案。',choice('essay','完成水道考','材料 2 文，书院付 14 文。',180,2,14),choice('notes','整理访谈录，保留疑点','材料 2 文，付 10 文；也是独立成果。',180,2,10))]},
 {id:'CH07',name:'老药师的旧病',location:'location.pharmacy',role:'R03',skill:null,requires:['CH02'],work:null,stages:[
 stage('知道药方的边界','合作过的药师旧病复发。他知道这张方子有什么用，也知道它到哪里就没有用了。',choice('stay','留下做普通照护','花三小时，减轻症状，不许诺痊愈。',180),choice('arrange','支付合格药工接手','8 文，确认有人接手再离开。',60,8)),
 stage('一份公开病案','经本人同意，你读到了可公开的旧病案，其中提到一位游方医者。',choice('read','整理病案与寻访线索','记录真实照护经历。',120),choice('support','支持寻医，继续本业','资助 4 文；不承担无法履行的长期约定。',60,4)),
 stage('接续生活','药铺另有人轮值。凡人医药与修持都不是治愈所有病的承诺。',choice('handover','完成交接','关系保留，药师回到自身生活。',60),choice('visit','约定日后再来问候','留通信地址；不要求患者永久在场。',60))]},
 {id:'CH08',name:'云岫同行',location:'location.mountain',role:'R08',skill:null,requires:['CH01'],work:null,stages:[
 stage('查路况','上山要有目的。积水的旧路不适合空手赶过去。',choice('survey','查看公开路况，规划绕路','耗时更长，但不依赖战斗。',120),choice('escort','询价并约好熟路者','12 文为这一程费用，未启程可取消；已出发不退。',60,12)),
 stage('脚印只进不出','同行者放下药篓。你可以改走有人维护的长路。',choice('detour','沿长路前行','六小时，消耗一日补给，不强闯险地。',360),choice('return','撤回，重新查证后走安全路','八小时，消耗一日补给；撤回不是失败归零。',480)),
 stage('到站与分账','松风旧观在雾后出现。各自采集的物件仍归各自。',choice('settle','结清这一程','释放同行占用，记录共同经历。',60),choice('contact','结清并交换通信处','同一个人留下联系办法。',60))]},
 {id:'CH09',name:'三扇门',location:'location.study',role:null,skill:null,requires:[],work:null,stages:[
 stage('问清来源','三份回答都没有许诺长生。一份列门规，一份写下次相见的地方，另一份留着注本的空白。',choice('independent','买公开基础注本','12 文；永久自学退路，后续须实证。',60,12),choice('sect','参加公开基础考察','用两小时完成考察，不强制加入宗门。',120)),
 stage('验证与责任','方法必须能够对应经验。课堂与师授的义务也必须讲清。',choice('observe','用重复观察验证','耗时三小时，理解来源、适用条件和局限。',180),choice('compare','核对第二来源与公开讲解','4 文，解答遗漏；同样完成可靠性验证。',120,4)),
 stage('当前安排','已学的基础不会因退出某种渠道而收回。你还可以改学适配的方法。',choice('accept','接受有限安排','宗门渠道需先做一次两小时杂务；独立求索用来补注。',120),choice('leave','不入宗，整理为自学记录','结清责任，保留已验证基础和公开注本退路。',180))]},
 {id:'CH10',name:'第一缕',location:'location.temple',role:null,skill:null,requires:['CH09'],work:null,stages:[
 stage('解释基本步骤','先理解运行说明，再选择适配的练法。具体方法在下方修持卡中选择。',choice('explain','逐条解释与核对','记录理解，所有天资都能继续。',120),choice('public','听公开基础讲解','多花时间理解，不以好感或道行为门槛。',180)),
 stage('准备与校验','安静、可承受的健康和正确样本，比盲目多练更重要。',choice('prepare','校验场所与样本','建立可重复的实践条件。',120),choice('adjust','采用短时适配法','为低天资或易疲劳者留出余量。',180))]}
];
// A third channel shares the same verification and obligation stages.
chains.find(c=>c.id==='CH09')!.stages[0].choices.push(choice('mentor','接受散修的有限指点','8 文准备材料；先演示，随后验证。',120,8));
export const methods=[{id:'MT01',name:'松风调息入门',application:'在调养中辨认何时应停止',location:'location.inn',requirement:'安静时段、健康至少 40；不增加攻击或寿数'}, {id:'MT02',name:'草木观息入门',application:'找出异常药畦的边界',location:'location.garden',requirement:'辨药至少 2；需公开对照样本，不自动掌握丹方'}, {id:'MT03',name:'静观引息入门',application:'复测旧观灵机出现条件',location:'location.temple',requirement:'持续专注和环境校验；不增加通用战力'}];
export const shortSeeds=[
 ['EV01','铺位漏雨','life','向店家换到干燥铺位','自己收拾后继续住'],['EV02','同住者清早离开','life','交换通信处','安静送行'],['EV03','搬柴少一人','life','帮忙说明接工时段','推荐公开用工告示'],['EV04','账目复核','life','当面核对已付食宿','请店家留下账单'],
 ['EV05','缺一味药','CH02','改用已核准批次','退回这批待加工药材'],['EV06','学徒争论火候','CH02','对照已记下的做法','请师傅另行示范'],['EV07','病人的负担','CH02','说明免费照护的边界','推荐药铺低价方案'],['EV08','晒药时的雨意','CH03','提醒药工先收入棚内','由轮值药工处理'],
 ['EV09','琴弦的旧痕','CH05','停下检查借用乐器','改为节拍练习'],['EV10','茶客点旧曲','CH05','演已学过的片段','说明尚不会完整原曲'],['EV11','乐友不同意见','CH05','分别保留两版尾声','各自完成自己的作品'],['EV12','小童想学琴','CH05','向监护人推荐正规教习','婉拒当前无法承担的教学'],
 ['EV13','抄本缺页','CH06','查另一版本补记','标明缺页'],['EV14','口述相互矛盾','CH06','注明两位受访者的来源','保留并列记录'],['EV15','讲会临时改期','CH06','留下改期通知','自行研读'],['EV16','文章署名讨论','CH06','列明资料与本人分工','只署自己的整理部分'],
 ['EV17','旧木料上的裂纹','CH04','向匠人核对用途','保留原先维修计划'],['EV18','赶工请托','CH04','说明当前工期后另约','拒绝插单'],['EV19','共用工具清点','CH04','当面清点后归架','请轮值匠人核对'],
 ['EV20','山路积水','CH08','确认安全绕行路线','延期出行'],['EV21','采药人歇脚','CH08','提醒不适先停止负重','指向山脚照护点'],['EV22','行商改道消息','CH09','核对公开注本的本地货源','留待下次，不付订金'],['EV23','速成仙方','CH09','请第三方核对说法','拒绝购买'],['EV24','旧友的来信','mail','回信说明近况','感谢来信，暂不约见']
].map(([id,name,trigger,act,decline])=>({id,name,trigger,act,decline}));
export function validateMortalContent(){
 const parsed=z.array(Chain).parse(chains),ids=new Set<string>();
 for(const group of [places,roles,parsed,methods,shortSeeds])for(const d of group){if(ids.has(d.id))throw new Error('凡尘重复 ID '+d.id);ids.add(d.id);}
 for(const c of parsed){if(!places.some(p=>p.id===c.location)||c.role&&!roles.some(r=>r.id===c.role)||c.requires.some(id=>!parsed.some(p=>p.id===id)))throw new Error('凡尘内容引用缺失 '+c.id);for(const s of c.stages)if(new Set(s.choices.map(c=>c.id)).size!==s.choices.length)throw new Error('重复选项');}
 return {chains:parsed,places,roles,methods,shortSeeds};
}
export const mortalContent=validateMortalContent();
