// English texts of the information pages. Keep the same sections as content-vi.ts (a test checks it).
import type { InfoContent, InfoSection } from './types';

export const EN: InfoContent = {
  updated: (date) => `Last updated: ${date}`,
  pages: (site) => {
    const operator = site.operator || 'an individual';
    const contact: InfoSection['links'] = site.email
      ? [{ href: `mailto:${site.email}`, label: site.email }]
      : undefined;
    const reach = site.email
      ? 'Parents and users can write to the address below.'
      : 'The contact email address is being set up.';
    const withContact = (section: InfoSection): InfoSection => ({
      ...section,
      ...(contact && { links: [...(section.links ?? []), ...contact] }),
    });

    return {
      about: {
        title: 'About BoardHub',
        description:
          'BoardHub helps children learn and play chess in Vietnamese, in the browser, with nothing to install.',
        intro: [
          'BoardHub introduces children to chess in Vietnamese: small steps, moving the pieces on the board themselves, then playing what they have just learned. It runs in the browser on computers, tablets and phones, with nothing to install.',
          'It is made for children from 5 years old. Many lessons are read aloud in Vietnamese, so a child who is still learning to read can follow.',
        ],
        sections: [
          {
            id: 'learn',
            title: 'What children learn',
            list: [
              'The board and its coordinates: the names of ranks and files, and how the pieces are set up.',
              'How each piece moves: rook, bishop, queen, king, knight and pawn.',
              'The important rules: capturing, check, checkmate, draws and the special moves.',
              'First openings and basic tactics, so a child starts to think ahead.',
            ],
          },
          {
            id: 'practice',
            title: 'Learning by playing',
            paragraphs: [
              'Practice follows the lessons, so children play the moves they have just seen. The puzzle page has short positions at several levels and a puzzle of the day. The journey page shows how far a child has come and how many stars they have.',
              'Children can play chess against the computer at three levels, two people on one device, or online in a private room with an invite code. There are also familiar board games such as gomoku, xiangqi and two Vietnamese folk games.',
            ],
            links: [
              { href: '/learn/chess/coordinates', label: 'Start the first lesson' },
              { href: '/puzzles', label: 'Solve puzzles' },
              { href: '/board-games', label: 'See the board games' },
            ],
          },
          {
            id: 'parents',
            title: 'Tips for parents',
            list: [
              'Ten to fifteen minutes at a time is enough for a young child; stop while it is still fun.',
              'Ask your child to explain how the new piece moves. Saying it in their own words shows they understand.',
              'After a mistake, ask “which piece do you think is under attack?” rather than showing the right move.',
              'No account is needed to learn. For online play, help your child pick a nickname, not their real name, and remind them not to share personal details in chat.',
            ],
          },
          {
            id: 'who',
            title: 'Who makes this site',
            paragraphs: [
              site.operator
                ? `BoardHub is built and run by ${site.operator}.`
                : 'BoardHub is a project built and run by one individual.',
            ],
            links: [{ href: '/contact', label: 'Contact' }],
          },
        ],
      },

      contact: {
        title: 'Contact',
        description:
          'How to reach BoardHub: feedback, bug reports and requests about a child’s personal data.',
        intro: [
          `BoardHub is run by ${operator}. I welcome feedback on the lessons, bug reports and any question from parents.`,
        ],
        sections: [
          withContact({ id: 'email', title: 'Email', paragraphs: [reach] }),
          {
            id: 'help',
            title: 'When reporting a bug, please tell me',
            list: [
              'Which page you were on and what you pressed before the problem.',
              'Your device and browser.',
              'A screenshot if you have one (hide personal details).',
              'Never send a password to anyone, including me.',
            ],
          },
          {
            id: 'chat',
            title: 'Reporting a player',
            paragraphs: [
              'Online rooms have a button to report a player. The report includes that player’s recent messages in the room, so an admin can review it, mute them or ban the account.',
            ],
          },
          {
            id: 'data',
            title: 'Requests about personal data',
            paragraphs: [
              'Parents can ask to see, correct or delete their child’s data. The privacy policy explains how.',
            ],
            links: [{ href: '/privacy', label: 'Privacy policy' }],
          },
        ],
      },

      privacy: {
        title: 'Privacy policy',
        description:
          'What data BoardHub collects, why, how long it is kept, and how parents can ask to see or delete their child’s data.',
        intro: [
          `This policy covers the data BoardHub, run by ${operator}, collects when you or your child use it. BoardHub is also for children, so I try to collect as little as I can.`,
          'In short: no account is needed to learn; I do not sell data; the site currently shows no advertising and uses no third-party tracking tools.',
        ],
        sections: [
          {
            id: 'device',
            title: 'Data kept on your device',
            paragraphs: [
              'BoardHub keeps some information in your browser’s storage (local storage and IndexedDB), so it works without an account:',
            ],
            list: [
              'Progress of lessons, practice and puzzles, the stars of the little games, and the days you played.',
              'The history of games played on the device or against the computer.',
              'Sound, voice and board settings.',
              'The sign-in session of an account or guest name, and the “do not ask again” choice.',
              'A random identifier made by the browser, with the time of last activity, to count visits.',
            ],
          },
          {
            id: 'device-control',
            title: 'Deleting data on your device',
            paragraphs: [
              'You can delete it at any time by clearing the site’s data in your browser. Progress not saved to an account is then lost. BoardHub currently sets no cookies. If that changes, this policy will be updated.',
            ],
          },
          {
            id: 'server',
            title: 'Data sent to the servers',
            list: [
              'Playing as a guest (creating a room, playing online or using a feature that needs an identity): a display name you type or one made up at random.',
              'Registered accounts: email, display name and password. The password is stored only as a hash (scrypt); nobody can read the original.',
              'Registered accounts also store learning progress, to sync it between devices, and the animal avatar if you choose one.',
              'Online play: games, moves, results, ratings and when the account was last active.',
              'Room chat: the server keeps at most the 50 latest messages of a room, normally no longer than about a day. When someone reports a player, up to 20 of that player’s recent messages are kept with the report.',
              'Player reports and the decisions taken (mute, ban).',
              'Group activities (lucky draws, lucky money): the session name, participants’ names and avatars, including names the host typed for them, and the results so anyone can verify them.',
            ],
          },
          {
            id: 'stats',
            title: 'Usage statistics',
            list: [
              'Visits: the browser’s random identifier, the day, the kind of user (not signed in, guest or registered) and the number of visits that day. Kept for about 90 days.',
              'When signed in: it is also noted that the account visited that day, apart from the browser identifier. Kept for about 90 days.',
              'When a lesson, practice or puzzle is finished: the day and the item, linked to the account if signed in, otherwise to the browser’s random identifier. Kept for about 400 days.',
              'Expired data is deleted automatically when the system records new data.',
            ],
          },
          {
            id: 'logs',
            title: 'Server logs',
            paragraphs: [
              'Like most websites, the servers and infrastructure providers keep technical logs, which may include your IP address, the time and the address requested. They are used to run the service, find faults and prevent abuse (for example limiting sign-in attempts). How long they are kept depends on configuration and provider.',
            ],
          },
          {
            id: 'use',
            title: 'What I use data for',
            list: [
              'Providing the features you use: sign-in, syncing progress, online play, rankings and replays.',
              'Safety: handling reports and preventing abuse.',
              'Understanding how the site is used, to improve the lessons.',
            ],
          },
          {
            id: 'visible',
            title: 'Who can see data',
            list: [
              'Public: display names can appear in rankings, in the list of live games and on replay pages (anyone with the link can watch). Children should use a nickname.',
              'People in your room: your display name and the messages you send there.',
              'Admins: name, email, account type, the days an account visited, overall learning figures, and reports with the related messages.',
              'The server and database providers process data for me. Their servers may be outside Vietnam.',
              'I do not sell personal data. I give data to authorities only when the law requires it.',
            ],
          },
          {
            id: 'children',
            title: 'Children and parents',
            paragraphs: [
              'Children can learn and solve puzzles without an account or any personal details. An account with an email should be created by a parent or guardian, or with their consent. The system does not yet check age or consent itself, so I ask parents to be involved.',
              'If you are a parent and believe your child gave me data without your consent, contact me and I will delete it.',
            ],
          },
          {
            id: 'retention',
            title: 'How long I keep data',
            paragraphs: [
              'Apart from the periods above, account information (guest accounts too), game history, ratings, reports and draw results are kept until deletion is requested or I no longer need them.',
            ],
          },
          withContact({
            id: 'rights',
            title: 'Seeing, correcting and deleting data',
            paragraphs: [
              'You can change your display name on the account page. To see, correct or delete an account and its data (yours or your child’s), send me a request from the registered email address. I may ask more to confirm who you are, and deletion is currently done by hand.',
              'Deletion removes the email, password, learning progress and statistics linked to the account. Games played with others stay in their history without your name. Published group draw results are kept so they can be verified; say so in your request if a name there must be removed too. Old backups are replaced over time.',
              'For people without a registered account I may be unable to tell which data is theirs.',
              reach,
            ],
          }),
          {
            id: 'ads',
            title: 'Advertising',
            paragraphs: [
              'BoardHub currently shows no advertising. I may use Google AdSense later to help pay for the site. Because BoardHub is directed at children, I would then mark the site as child-directed so that no personalised advertising is shown.',
              'With advertising, Google and its partners may receive some technical information (such as your IP address) and use cookies or identifiers under their own policies, for example to deliver and measure ads and to prevent fraud. This policy will be updated before advertising is turned on.',
            ],
            links: [
              {
                href: 'https://policies.google.com/technologies/partner-sites',
                label: 'How Google uses data on partner sites',
              },
              { href: 'https://adssettings.google.com', label: 'Google ad settings' },
            ],
          },
          {
            id: 'security',
            title: 'Security',
            paragraphs: [
              'The site uses encrypted HTTPS connections, passwords are hashed, and the admin pages are only for accounts with that role. No system is perfectly secure, so use a password you use only for BoardHub.',
            ],
          },
          {
            id: 'changes',
            title: 'Changes to this policy',
            paragraphs: [
              'When this policy changes I update this page and the date at the top. Important changes about children’s data will be announced clearly on the site.',
            ],
            links: [{ href: '/contact', label: 'Contact' }],
          },
        ],
      },

      terms: {
        title: 'Terms of use',
        description: 'The rules for using BoardHub: accounts, behaviour in online play and responsibility.',
        intro: [
          `By using BoardHub, run by ${operator}, you agree to these terms. Children should read them with a parent or guardian and need their consent.`,
        ],
        sections: [
          {
            id: 'service',
            title: 'The service',
            paragraphs: [
              'BoardHub offers chess lessons, puzzles, board games and group activities in the browser. It is currently free. I may add, change or stop a feature.',
            ],
          },
          {
            id: 'accounts',
            title: 'Accounts',
            list: [
              'Use your own details, or your child’s when you register for them as a parent.',
              'Keep your password private and tell me if you think someone else is using your account.',
              'Choose a polite display name with no personal details in it.',
            ],
          },
          {
            id: 'conduct',
            title: 'Behaviour',
            paragraphs: ['Children use this site. You must not:'],
            list: [
              'Swear, insult, bully, threaten or discriminate.',
              'Ask for or share personal details such as an address, phone number, school or social media account, or invite someone to make contact or meet outside the site.',
              'Post adult, violent or unlawful content, or advertising.',
              'Cheat, pretend to be someone else, attack, probe or overload the system.',
            ],
          },
          {
            id: 'moderation',
            title: 'Breaking the rules',
            paragraphs: [
              'Admins may mute, suspend or ban accounts that break these rules. If you think a decision is wrong, contact me to have it reviewed.',
            ],
            links: [{ href: '/contact', label: 'Contact' }],
          },
          {
            id: 'content',
            title: 'Content',
            paragraphs: [
              'Please do not copy BoardHub’s lessons, drawings, sounds or interface for commercial use without permission. Parts that belong to others (such as open-source libraries) follow their licences. You are responsible for the messages and names you create.',
            ],
          },
          {
            id: 'games',
            title: 'No games for money',
            paragraphs: [
              'Points, stars, rankings, draws and lucky money games on the site have no money value, and the site handles no payments or bets. If a group hands out real prizes, that group is responsible for them.',
            ],
          },
          {
            id: 'liability',
            title: 'Limits of responsibility',
            paragraphs: [
              'The site is provided as it is. I try to keep it running but do not promise it will be uninterrupted or free of faults; games, progress or data may be lost in a failure. Nothing here removes rights or duties that the law does not allow to be removed.',
            ],
          },
          {
            id: 'law',
            title: 'Changes and governing law',
            paragraphs: [
              'I may update these terms and will show the date at the top. They are governed by the law of Vietnam.',
            ],
            links: [{ href: '/privacy', label: 'Privacy policy' }],
          },
        ],
      },
    };
  },
};
