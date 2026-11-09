part of '../main.dart';

mixin ExtrasScreens on MissionController {
  Widget achievements() {
    final all = [
      'First Launch',
      'Reached Space',
      'Stable Orbit',
      'First Lunar Flyby',
      'First Lunar Landing',
      'Budget Master',
      'Power Efficiency Expert',
      'Scientific Pioneer',
    ];
    final descriptions = [
      'Begin a campaign launch.',
      'Complete atmospheric science beyond 100 km.',
      'Insert into orbit and return your observations.',
      'Return scientific data from a lunar flyby.',
      'Soft-land and transmit lunar surface science.',
      'Complete a mission at 85% of its budget cap or less.',
      'Complete a flight with at least 100 W net power.',
      'Return 60 total campaign science points.',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PageHeading(
          'THE MILESTONE ARCHIVE',
          'Proof of possibility.',
          '${p.achievements.length} / ${all.length} milestones earned through real campaign decisions.',
        ),
        LayoutBuilder(
          builder: (c, b) => Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              for (var i = 0; i < all.length; i++)
                SizedBox(
                  width: b.maxWidth > 800
                      ? (b.maxWidth - 32) / 3
                      : b.maxWidth > 500
                      ? (b.maxWidth - 16) / 2
                      : b.maxWidth,
                  child: Plate(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          p.achievements.contains(all[i])
                              ? Icons.workspace_premium
                              : Icons.lock_outline,
                          color: p.achievements.contains(all[i]) ? cyan : dim,
                          size: 32,
                        ),
                        const SizedBox(height: 23),
                        Text(all[i], style: const TextStyle(fontSize: 17)),
                        const SizedBox(height: 10),
                        Text(
                          descriptions[i],
                          style: const TextStyle(
                            fontSize: 11,
                            color: dim,
                            height: 1.7,
                          ),
                        ),
                        const SizedBox(height: 18),
                        Tag(
                          p.achievements.contains(all[i])
                              ? 'UNLOCKED'
                              : 'AWAITING DISCOVERY',
                          color: p.achievements.contains(all[i]) ? cyan : dim,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> searchNasa() async {
    setState(() => searching = true);
    try {
      final response = await http
          .get(
            Uri.https('images-api.nasa.gov', '/search', {
              'q': 'Apollo Earth Moon',
              'media_type': 'image',
              'page_size': '6',
            }),
          )
          .timeout(const Duration(seconds: 12));
      if (response.statusCode != 200) {
        throw Exception('NASA service unavailable');
      }
      final items = jsonDecode(response.body)['collection']['items'] as List;
      final images = <Map<String, dynamic>>[];
      for (final item in items) {
        final d = item['data'][0], links = item['links'] as List?;
        if (links == null || links.isEmpty) continue;
        final url = links.first['href'] as String;
        if (!url.startsWith('https://')) continue;
        images.add({
          'id': d['nasa_id'],
          'title': d['title'],
          'description': d['description'] ?? '',
          'credit': d['photographer'] ?? d['center'] ?? 'NASA',
          'url': url,
        });
      }
      if (!mounted) return;
      setState(() {
        discoveries = images;
        galleryStatus =
            'NASA Image and Video Library · Images remain subject to their credited rights.';
      });
      await widget.store.writeString('gallery', jsonEncode(images));
    } catch (_) {
      if (mounted) {
        setState(
          () => galleryStatus =
              'NASA is unreachable right now. Offline mission stories and previously saved discoveries are still available.',
        );
      }
    }
    if (mounted) {
      setState(() => searching = false);
    }
  }

  Widget gallery() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      PageHeading(
        'DISCOVERY / MISSION GALLERY',
        'A universe worth exploring.',
        galleryStatus,
      ),
      ActionButton(
        searching ? 'Contacting NASA…' : 'Discover NASA images',
        onPressed: searching ? null : searchNasa,
        secondary: true,
        icon: Icons.travel_explore,
      ),
      const SizedBox(height: 24),
      for (var i = 0; i < widget.missions.length; i++)
        if (i == 0 || p.completed.contains(widget.missions[i].id))
          Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Plate(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 90,
                    height: 100,
                    child: CustomPaint(painter: SpaceArt(moon: i >= 2)),
                  ),
                  const SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        label('HISTORICAL FIELD NOTES', color: orange, size: 8),
                        const SizedBox(height: 10),
                        Text(
                          widget.missions[i].history,
                          style: const TextStyle(
                            fontSize: 12,
                            color: dim,
                            height: 1.8,
                          ),
                        ),
                        const SizedBox(height: 8),
                        label('ORIGINAL ILLUSTRATION · OFFLINE', size: 7),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      for (final image in discoveries)
        Padding(
          padding: const EdgeInsets.only(bottom: 20),
          child: Plate(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(7),
                  child: Image.network(
                    image['url'],
                    height: 240,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (c, e, s) => SizedBox(
                      height: 150,
                      child: Center(child: label('IMAGE UNAVAILABLE OFFLINE')),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(image['title'], style: const TextStyle(fontSize: 19)),
                const SizedBox(height: 10),
                Text(
                  (image['description'] as String).replaceAll(
                    RegExp('<[^>]*>'),
                    '',
                  ),
                  maxLines: 5,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: dim, height: 1.8),
                ),
                const SizedBox(height: 14),
                label('CREDIT: ${image['credit']} · NASA LIBRARY', size: 8),
                const SizedBox(height: 8),
                Text(
                  widget.store.persistent
                      ? 'Metadata saved locally. Full-resolution images require a connection.'
                      : 'Metadata kept for this tab only. Device storage is unavailable.',
                  style: TextStyle(color: dim, fontSize: 10),
                ),
              ],
            ),
          ),
        ),
    ],
  );
  Widget settings() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      PageHeading(
        'CONSOLE PREFERENCES',
        'Your mission. Your pace.',
        saveOk
            ? 'Progress is saved on this device. No account or permanent connection is required.'
            : 'Session-only mode: progress stays in this tab while device storage is unavailable.',
      ),
      Plate(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Mute audio', style: TextStyle(fontSize: 16)),
              subtitle: const Text(
                'Original synthesized sounds and ambience',
                style: TextStyle(fontSize: 11, color: dim),
              ),
              value: p.muted,
              onChanged: (v) {
                setState(() => p.muted = v);
                audio.muted = v;
                audio.stop();
                save();
              },
            ),
            const SizedBox(height: 12),
            if (kIsWeb)
              ValueListenableBuilder<bool>(
                valueListenable: audio.needsGesture,
                builder: (context, blocked, child) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      blocked
                          ? 'Safari could not start sound. Tap Enable sound to retry. Gameplay remains available.'
                          : 'Browser sound starts after a click, tap, or key. You can enable it here.',
                      style: TextStyle(
                        color: blocked ? orange : dim,
                        fontSize: 12,
                        height: 1.7,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ActionButton(
                      'Enable sound',
                      secondary: true,
                      icon: Icons.volume_up_outlined,
                      onPressed: () async {
                        setState(() => p.muted = false);
                        final enabled = await audio.enable();
                        if (!mounted) return;
                        toast(
                          enabled
                              ? 'Sound enabled.'
                              : 'Sound is still unavailable. Check Safari audio permissions and try again.',
                        );
                        save();
                      },
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            label('MASTER VOLUME'),
            Slider(
              value: p.volume,
              onChanged: (v) {
                setState(() => p.volume = v);
                audio.volume = v;
                save();
              },
              onChangeEnd: (_) => audio.play('click'),
            ),
            const Divider(),
            const SizedBox(height: 20),
            label('LOCAL STORAGE', color: saveOk ? cyan : orange),
            const SizedBox(height: 10),
            Text(
              saveOk
                  ? 'Campaign, spacecraft, achievements, and active flight are saved every two seconds and at important decisions. A resumed flight starts paused.'
                  : 'Progress is kept for this tab only. Reloading will lose it. Allow website storage or free device space, then reload to use persistent saves.',
              style: const TextStyle(color: dim, fontSize: 12, height: 1.8),
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 14,
              runSpacing: 10,
              children: [
                ActionButton(
                  'Save now',
                  onPressed: () async {
                    await save();
                    toast(
                      saveOk
                          ? 'Programme saved on this device.'
                          : 'Save failed. Check storage permissions.',
                    );
                  },
                  secondary: true,
                  icon: Icons.save_outlined,
                ),
                ActionButton(
                  'Hear ambience',
                  onPressed: () => audio.loop('ambient'),
                  secondary: true,
                  icon: Icons.music_note_outlined,
                ),
              ],
            ),
            if (p.active != null) ...[
              const SizedBox(height: 20),
              ActionButton(
                'Abandon active flight',
                secondary: true,
                icon: Icons.close,
                onPressed: () {
                  continueMission();
                  finish(
                    false,
                    'The mission was ended by flight control. The launch expenditure remains spent.',
                  );
                },
              ),
            ],
            const SizedBox(height: 20),
            TextButton(
              onPressed: learnMore,
              child: const Text(
                'Engineering assumptions & learning guide',
                style: TextStyle(color: cyan),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'An independent NASA Space Apps game concept. Not affiliated with or endorsed by NASA. All programme values are fictional. Earth and Moon art and sounds are original procedural assets.',
              style: TextStyle(color: dim, fontSize: 10, height: 1.8),
            ),
          ],
        ),
      ),
    ],
  );
}
