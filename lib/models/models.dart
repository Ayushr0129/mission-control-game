class Part {
  final String id, name, category, description;
  final double mass, cost, draw, power, fuel, isp, thrust;
  final int range, science;
  Part(Map<String, dynamic> j)
    : id = j['id'],
      name = j['name'],
      category = j['category'],
      description = j['description'],
      mass = (j['mass'] ?? 0).toDouble(),
      cost = (j['cost'] ?? 0).toDouble(),
      draw = (j['draw'] ?? 0).toDouble(),
      power = (j['power'] ?? 0).toDouble(),
      fuel = (j['fuel'] ?? 0).toDouble(),
      isp = (j['isp'] ?? 0).toDouble(),
      thrust = (j['thrust'] ?? 0).toDouble(),
      range = j['range'] ?? 0,
      science = j['science'] ?? 0;
}

class Mission {
  final String id, name, subtitle, destination, history, objective, duration;
  final double budget, deltaV, reward, altitude;
  final int range, science;
  Mission(Map<String, dynamic> j)
    : id = j['id'],
      name = j['name'],
      subtitle = j['subtitle'],
      destination = j['destination'],
      history = j['history'],
      objective = j['objective'],
      duration = j['duration'],
      budget = j['budget'].toDouble(),
      deltaV = j['deltaV'].toDouble(),
      reward = j['reward'].toDouble(),
      altitude = j['altitude'].toDouble(),
      range = j['range'],
      science = j['science'];
}

class Programme {
  double funding, trust, reputation;
  int science, attempts, seed;
  Set<String> completed, achievements;
  List<String> design;
  Map<String, dynamic>? active;
  bool muted;
  double volume;
  String launcherId;
  bool musicEnabled;
  double musicVolume;
  String musicTrack;
  Programme({
    this.funding = 45,
    this.trust = 70,
    this.reputation = 0,
    this.science = 0,
    this.attempts = 0,
    this.seed = 42,
    Set<String>? completed,
    Set<String>? achievements,
    List<String>? design,
    this.active,
    this.muted = false,
    this.volume = .35,
    this.launcherId = 'standard',
    this.musicEnabled = true,
    this.musicVolume = .4,
    this.musicTrack = 'music_control',
  }) : completed = completed ?? {},
       achievements = achievements ?? {},
       design =
           design ??
           ['core', 'engine1', 'tank1', 'solar1', 'antenna1', 'camera'];
  bool get gameOver => funding < 5 || trust <= 0;
  Map<String, dynamic> toJson() => {
    'version': 1,
    'funding': funding,
    'trust': trust,
    'reputation': reputation,
    'science': science,
    'attempts': attempts,
    'seed': seed,
    'completed': completed.toList(),
    'achievements': achievements.toList(),
    'design': design,
    'active': active,
    'muted': muted,
    'volume': volume,
    'launcherId': launcherId,
    'musicEnabled': musicEnabled,
    'musicVolume': musicVolume,
    'musicTrack': musicTrack,
  };
  factory Programme.fromJson(Map<String, dynamic> j) => Programme(
    funding: (j['funding'] as num).toDouble(),
    trust: (j['trust'] as num).toDouble(),
    reputation: (j['reputation'] as num).toDouble(),
    science: j['science'],
    attempts: j['attempts'],
    seed: j['seed'],
    completed: Set<String>.from(j['completed']),
    achievements: Set<String>.from(j['achievements']),
    design: List<String>.from(j['design']),
    active: j['active'] == null ? null : Map<String, dynamic>.from(j['active']),
    muted: j['muted'] ?? false,
    volume: (j['volume'] ?? .35).toDouble(),
    launcherId: j['launcherId'] ?? 'standard',
    musicEnabled: j['musicEnabled'] ?? true,
    musicVolume: ((j['musicVolume'] ?? .4) as num).toDouble().clamp(0, 1),
    musicTrack: j['musicTrack'] == 'music_horizon'
        ? 'music_horizon'
        : 'music_control',
  );
}
