// The texts of the information pages. They are long and only the server renders them, so they live here and
// not in the message files (which are sent to every page). Keep the same sections as content-en.ts.
//
// The privacy policy states what the system really does. When data collection, retention or who can see what
// changes (apps/server/src/db, stats, admin; browser storage), change both languages and LEGAL_UPDATED.
import type { InfoContent, InfoSection } from './types';

export const VI: InfoContent = {
  updated: (date) => `Cập nhật lần cuối: ${date}`,
  pages: (site) => {
    const operator = site.operator || 'một cá nhân';
    const contact: InfoSection['links'] = site.email
      ? [{ href: `mailto:${site.email}`, label: site.email }]
      : undefined;
    const reach = site.email
      ? 'Phụ huynh hoặc người dùng gửi email tới địa chỉ dưới đây.'
      : 'Địa chỉ email liên hệ đang được cập nhật.';
    const withContact = (section: InfoSection): InfoSection => ({
      ...section,
      ...(contact && { links: [...(section.links ?? []), ...contact] }),
    });

    return {
      about: {
        title: 'Giới thiệu BoardHub',
        description:
          'BoardHub là trang web giúp bé học và chơi cờ vua bằng tiếng Việt, ngay trên trình duyệt, không cần cài đặt.',
        intro: [
          'BoardHub giúp các bé làm quen với cờ vua bằng tiếng Việt: học từng bước nhỏ, tự tay đi quân trên bàn cờ, rồi chơi ngay những gì vừa học. Trang chạy trên trình duyệt của máy tính, máy tính bảng và điện thoại, không cần cài đặt.',
          'Nội dung được thiết kế cho bé từ 5 tuổi. Nhiều bài có giọng đọc tiếng Việt, để bé chưa đọc thạo vẫn theo dõi được.',
        ],
        sections: [
          {
            id: 'learn',
            title: 'Bé học được gì',
            list: [
              'Bàn cờ và tọa độ: biết tên hàng, tên cột và cách xếp quân lúc bắt đầu.',
              'Cách đi của từng quân: xe, tượng, hậu, vua, mã và tốt.',
              'Luật quan trọng: ăn quân, chiếu, chiếu hết, hòa cờ và các nước đi đặc biệt.',
              'Khai cuộc và đòn phối hợp cơ bản, để bé bắt đầu biết tính trước.',
            ],
          },
          {
            id: 'practice',
            title: 'Học đi đôi với chơi',
            paragraphs: [
              'Sau bài học có phần luyện tập để bé tự đi lại các nước vừa xem. Mục Câu đố có những thế cờ ngắn theo nhiều mức, cùng một câu đố mỗi ngày. Trang Hành trình cho bé thấy mình đã đi được đến đâu và thu được bao nhiêu ngôi sao.',
              'Bé có thể chơi cờ vua với máy ở ba mức khó, chơi hai người trên cùng một máy, hoặc chơi trực tuyến trong phòng riêng bằng mã mời. Ngoài cờ vua còn có một số board game quen thuộc như caro, cờ tướng, cờ gánh và ô ăn quan.',
            ],
            links: [
              { href: '/learn/chess/coordinates', label: 'Bắt đầu bài học đầu tiên' },
              { href: '/puzzles', label: 'Giải câu đố' },
              { href: '/board-games', label: 'Xem các board game' },
            ],
          },
          {
            id: 'parents',
            title: 'Gợi ý cho phụ huynh',
            list: [
              'Mỗi lần học 10–15 phút là đủ với bé nhỏ; dừng lại khi bé vẫn còn thấy vui.',
              'Nhờ bé kể lại quân cờ vừa học đi như thế nào. Nói được bằng lời của mình là bé đã hiểu.',
              'Khi bé đi sai, hãy hỏi “con thấy quân nào đang bị đe dọa?” thay vì chỉ luôn nước đúng.',
              'Bé không cần tài khoản để học. Nếu chơi trực tuyến, hãy nhắc bé đặt biệt danh, không dùng tên thật và không chia sẻ thông tin cá nhân trong khung chat.',
            ],
          },
          {
            id: 'who',
            title: 'Ai làm trang này',
            paragraphs: [
              site.operator
                ? `BoardHub do ${site.operator} xây dựng và vận hành.`
                : 'BoardHub là dự án do một cá nhân phát triển và vận hành.',
            ],
            links: [{ href: '/contact', label: 'Liên hệ' }],
          },
        ],
      },

      contact: {
        title: 'Liên hệ',
        description: 'Cách liên hệ với BoardHub: góp ý, báo lỗi và yêu cầu về dữ liệu cá nhân của trẻ.',
        intro: [
          `BoardHub do ${operator} vận hành. Tôi mong nhận được góp ý về bài học, báo lỗi và mọi câu hỏi của phụ huynh.`,
        ],
        sections: [
          withContact({ id: 'email', title: 'Email', paragraphs: [reach] }),
          {
            id: 'help',
            title: 'Khi báo lỗi, vui lòng cho biết',
            list: [
              'Bạn đang ở trang nào và đã bấm gì trước khi gặp lỗi.',
              'Loại thiết bị và trình duyệt đang dùng.',
              'Ảnh chụp màn hình nếu có (hãy che thông tin cá nhân).',
              'Đừng gửi mật khẩu cho bất kỳ ai, kể cả tôi.',
            ],
          },
          {
            id: 'chat',
            title: 'Báo cáo người chơi không phù hợp',
            paragraphs: [
              'Trong phòng chơi trực tuyến có nút báo cáo người chơi. Báo cáo kèm các tin nhắn gần đây của người bị báo cáo trong phòng đó, để quản trị viên xem xét, cấm chat hoặc khóa tài khoản.',
            ],
          },
          {
            id: 'data',
            title: 'Yêu cầu về dữ liệu cá nhân',
            paragraphs: [
              'Phụ huynh có thể yêu cầu xem, sửa hoặc xóa dữ liệu của con. Xem cách gửi yêu cầu trong Chính sách quyền riêng tư.',
            ],
            links: [{ href: '/privacy', label: 'Chính sách quyền riêng tư' }],
          },
        ],
      },

      privacy: {
        title: 'Chính sách quyền riêng tư',
        description:
          'BoardHub thu thập dữ liệu gì, dùng để làm gì, lưu bao lâu và cách phụ huynh yêu cầu xem hoặc xóa dữ liệu của con.',
        intro: [
          `Chính sách này nói về dữ liệu mà trang BoardHub, do ${operator} vận hành, thu thập khi bạn hoặc con bạn sử dụng. BoardHub dành cho cả trẻ em, nên tôi cố gắng thu thập ít nhất có thể.`,
          'Tóm tắt: không cần tài khoản để học; tôi không bán dữ liệu; hiện trang không có quảng cáo và không dùng công cụ theo dõi của bên thứ ba.',
        ],
        sections: [
          {
            id: 'device',
            title: 'Dữ liệu lưu trên thiết bị của bạn',
            paragraphs: [
              'BoardHub lưu một số thông tin trong bộ nhớ của trình duyệt (local storage và IndexedDB), để trang hoạt động mà không cần tài khoản:',
            ],
            list: [
              'Tiến độ bài học, luyện tập, câu đố và các ngày đã chơi.',
              'Lịch sử những ván chơi trên máy hoặc với máy.',
              'Cài đặt âm thanh, giọng đọc và bàn cờ.',
              'Phiên đăng nhập của tài khoản hoặc tên khách, và lựa chọn “không hỏi lại”.',
              'Một mã ngẫu nhiên do trình duyệt tự tạo, cùng thời điểm hoạt động gần nhất, để đếm lượt truy cập.',
            ],
          },
          {
            id: 'device-control',
            title: 'Xóa dữ liệu trên thiết bị',
            paragraphs: [
              'Bạn có thể xóa bất cứ lúc nào bằng cách xóa dữ liệu trang web trong trình duyệt. Khi đó tiến độ chưa đồng bộ vào tài khoản sẽ mất. Hiện BoardHub không đặt cookie. Nếu sau này dùng cookie, chính sách này sẽ được cập nhật.',
            ],
          },
          {
            id: 'server',
            title: 'Dữ liệu gửi lên máy chủ',
            list: [
              'Chơi với tên khách (khi tạo phòng, chơi trực tuyến hoặc dùng tính năng cần danh tính): tên hiển thị do bạn nhập hoặc do hệ thống đặt ngẫu nhiên.',
              'Tài khoản đăng ký: email, tên hiển thị và mật khẩu. Mật khẩu chỉ được lưu dưới dạng đã băm (scrypt), không ai đọc được mật khẩu gốc.',
              'Tài khoản đăng ký còn lưu tiến độ học để đồng bộ giữa các thiết bị, và hình con vật đại diện nếu bạn chọn.',
              'Chơi trực tuyến: các ván đấu, nước đi, kết quả, điểm xếp hạng và thời điểm tài khoản hoạt động gần nhất.',
              'Tin nhắn trong phòng chơi: máy chủ giữ tối đa 50 tin gần nhất của phòng, thường không quá khoảng một ngày. Khi có người báo cáo, tối đa 20 tin gần đây của người bị báo cáo được lưu cùng báo cáo.',
              'Báo cáo người chơi và quyết định xử lý (cấm chat, khóa tài khoản).',
              'Hoạt động nhóm (bốc thăm, lì xì): tên phiên, tên và hình đại diện của người tham gia, kể cả tên do người chủ trì nhập hộ, cùng kết quả để mọi người kiểm chứng.',
            ],
          },
          {
            id: 'stats',
            title: 'Thống kê sử dụng',
            list: [
              'Lượt truy cập: mã ngẫu nhiên của trình duyệt, ngày, loại người dùng (chưa đăng nhập, khách hay đã đăng ký) và số lần vào trong ngày. Lưu khoảng 90 ngày.',
              'Nếu đã đăng nhập: ghi thêm rằng tài khoản đó có vào trong ngày, tách riêng khỏi mã của trình duyệt. Lưu khoảng 90 ngày.',
              'Khi hoàn thành bài học, luyện tập hoặc câu đố: ngày và tên mục đã hoàn thành, gắn với tài khoản nếu đã đăng nhập, nếu không thì gắn với mã ngẫu nhiên của trình duyệt. Lưu khoảng 400 ngày.',
              'Dữ liệu quá hạn được xóa tự động khi hệ thống ghi nhận dữ liệu mới.',
            ],
          },
          {
            id: 'logs',
            title: 'Nhật ký máy chủ',
            paragraphs: [
              'Như hầu hết trang web, máy chủ và nhà cung cấp hạ tầng ghi nhật ký kỹ thuật, có thể gồm địa chỉ IP, thời điểm và địa chỉ được yêu cầu. Chúng dùng để vận hành, tìm lỗi và chống lạm dụng (ví dụ giới hạn số lần đăng nhập). Thời gian lưu tùy theo cấu hình và nhà cung cấp.',
            ],
          },
          {
            id: 'use',
            title: 'Tôi dùng dữ liệu để làm gì',
            list: [
              'Cung cấp các tính năng bạn dùng: đăng nhập, đồng bộ tiến độ, chơi trực tuyến, xếp hạng, xem lại ván.',
              'Giữ an toàn: xử lý báo cáo, ngăn lạm dụng.',
              'Hiểu trang được dùng thế nào để cải thiện bài học.',
            ],
          },
          {
            id: 'visible',
            title: 'Ai nhìn thấy dữ liệu',
            list: [
              'Công khai: tên hiển thị có thể xuất hiện ở bảng xếp hạng, danh sách ván đang diễn ra và trang xem lại ván (ai có đường link đều xem được). Vì vậy bé nên dùng biệt danh.',
              'Người cùng phòng: tên hiển thị và tin nhắn bạn gửi trong phòng.',
              'Quản trị viên: tên, email, loại tài khoản, những ngày tài khoản truy cập, số liệu học tập tổng hợp, và báo cáo kèm tin nhắn liên quan.',
              'Nhà cung cấp dịch vụ máy chủ và cơ sở dữ liệu xử lý dữ liệu thay cho tôi. Máy chủ của họ có thể đặt ngoài Việt Nam.',
              'Tôi không bán dữ liệu cá nhân. Tôi chỉ cung cấp dữ liệu cho cơ quan có thẩm quyền khi pháp luật yêu cầu.',
            ],
          },
          {
            id: 'children',
            title: 'Trẻ em và phụ huynh',
            paragraphs: [
              'Bé học bài và giải câu đố mà không cần tài khoản hay nhập thông tin cá nhân. Việc đăng ký tài khoản bằng email nên do cha mẹ hoặc người giám hộ thực hiện, hoặc được họ đồng ý. Hiện hệ thống chưa tự kiểm tra tuổi hay sự đồng ý này, nên tôi đề nghị phụ huynh đồng hành cùng con.',
              'Nếu bạn là phụ huynh và cho rằng con đã cung cấp dữ liệu khi chưa được bạn đồng ý, hãy liên hệ để tôi xóa.',
            ],
          },
          {
            id: 'retention',
            title: 'Tôi lưu dữ liệu bao lâu',
            paragraphs: [
              'Ngoài các thời hạn nêu ở trên, thông tin tài khoản (kể cả tài khoản khách), lịch sử ván đấu, điểm xếp hạng, báo cáo và kết quả bốc thăm được lưu cho đến khi có yêu cầu xóa hoặc tôi không còn cần đến.',
            ],
          },
          withContact({
            id: 'rights',
            title: 'Xem, sửa và xóa dữ liệu',
            paragraphs: [
              'Bạn có thể đổi tên hiển thị trong trang Tài khoản. Để xem, sửa hoặc xóa tài khoản và dữ liệu (của bạn hoặc của con), hãy gửi yêu cầu cho tôi từ chính email đã đăng ký. Tôi có thể hỏi thêm để xác minh, và hiện việc xóa được thực hiện thủ công.',
              'Khi xóa, email, mật khẩu, tiến độ học và thống kê gắn với tài khoản được gỡ bỏ. Các ván đã đấu với người khác vẫn còn trong lịch sử của họ nhưng không còn mang tên bạn. Kết quả bốc thăm nhóm đã công bố được giữ để kiểm chứng; nếu cần xóa tên trong đó, hãy ghi rõ trong yêu cầu. Bản sao lưu cũ tự bị thay thế theo thời gian.',
              'Với người dùng không có tài khoản đăng ký, tôi có thể không xác định được dữ liệu nào là của bạn.',
              reach,
            ],
          }),
          {
            id: 'ads',
            title: 'Quảng cáo',
            paragraphs: [
              'Hiện BoardHub không hiển thị quảng cáo. Tôi có thể dùng Google AdSense trong tương lai để có kinh phí duy trì trang. Khi đó, vì BoardHub hướng tới trẻ em, tôi sẽ cấu hình trang là nội dung dành cho trẻ em để không hiển thị quảng cáo cá nhân hóa.',
              'Khi có quảng cáo, Google và các đối tác của Google có thể nhận một số thông tin kỹ thuật (như địa chỉ IP) và dùng cookie hoặc mã định danh theo chính sách của họ, ví dụ để phân phối quảng cáo, đo lường và chống gian lận. Chính sách này sẽ được cập nhật trước khi bật quảng cáo.',
            ],
            links: [
              {
                href: 'https://policies.google.com/technologies/partner-sites',
                label: 'Cách Google dùng dữ liệu trên trang của đối tác',
              },
              { href: 'https://adssettings.google.com', label: 'Cài đặt quảng cáo của Google' },
            ],
          },
          {
            id: 'security',
            title: 'Bảo mật',
            paragraphs: [
              'Trang dùng kết nối mã hóa HTTPS, mật khẩu được băm, và trang quản trị chỉ dành cho tài khoản được cấp quyền. Không hệ thống nào an toàn tuyệt đối, nên hãy dùng mật khẩu riêng cho BoardHub.',
            ],
          },
          {
            id: 'changes',
            title: 'Thay đổi chính sách',
            paragraphs: [
              'Khi chính sách thay đổi, tôi cập nhật trang này và ngày ở đầu trang. Thay đổi quan trọng về dữ liệu của trẻ em sẽ được thông báo rõ trên trang.',
            ],
            links: [{ href: '/contact', label: 'Liên hệ' }],
          },
        ],
      },

      terms: {
        title: 'Điều khoản sử dụng',
        description: 'Quy tắc khi dùng BoardHub: tài khoản, cư xử khi chơi trực tuyến và trách nhiệm.',
        intro: [
          `Khi dùng BoardHub, do ${operator} vận hành, bạn đồng ý với các điều khoản dưới đây. Trẻ em nên đọc cùng cha mẹ hoặc người giám hộ và cần được họ đồng ý.`,
        ],
        sections: [
          {
            id: 'service',
            title: 'Dịch vụ',
            paragraphs: [
              'BoardHub cung cấp bài học cờ vua, câu đố, board game và hoạt động nhóm trên trình duyệt. Hiện việc sử dụng là miễn phí. Tôi có thể thêm, đổi hoặc ngừng một tính năng.',
            ],
          },
          {
            id: 'accounts',
            title: 'Tài khoản',
            list: [
              'Dùng thông tin của chính mình, hoặc của con khi bạn là phụ huynh đăng ký giúp.',
              'Giữ kín mật khẩu và báo cho tôi nếu nghi ngờ tài khoản bị người khác dùng.',
              'Chọn tên hiển thị lịch sự và không chứa thông tin cá nhân.',
            ],
          },
          {
            id: 'conduct',
            title: 'Cư xử khi chơi',
            paragraphs: ['Đây là nơi có trẻ em. Bạn không được:'],
            list: [
              'Nói tục, xúc phạm, bắt nạt, đe dọa hoặc phân biệt đối xử.',
              'Hỏi hoặc chia sẻ thông tin cá nhân như địa chỉ, số điện thoại, trường học, tài khoản mạng xã hội; rủ người khác liên lạc hoặc gặp nhau ngoài trang.',
              'Đăng nội dung người lớn, bạo lực, trái pháp luật hoặc quảng cáo.',
              'Gian lận, giả mạo người khác, tấn công, dò quét hoặc làm quá tải hệ thống.',
            ],
          },
          {
            id: 'moderation',
            title: 'Xử lý vi phạm',
            paragraphs: [
              'Quản trị viên có thể cấm chat, tạm khóa hoặc khóa tài khoản vi phạm. Nếu cho rằng quyết định chưa đúng, bạn có thể liên hệ để được xem xét lại.',
            ],
            links: [{ href: '/contact', label: 'Liên hệ' }],
          },
          {
            id: 'content',
            title: 'Nội dung',
            paragraphs: [
              'Vui lòng không sao chép bài học, hình vẽ, âm thanh hay giao diện của BoardHub để dùng cho mục đích thương mại khi chưa được đồng ý. Phần thuộc về bên khác (ví dụ thư viện mã nguồn mở) theo giấy phép của họ. Tin nhắn và tên do bạn tạo ra là trách nhiệm của bạn.',
            ],
          },
          {
            id: 'games',
            title: 'Không có trò chơi ăn tiền',
            paragraphs: [
              'Điểm, ngôi sao, xếp hạng và các trò bốc thăm hay lì xì trên trang không có giá trị tiền tệ, và trang không xử lý thanh toán hay đặt cược. Nếu một nhóm tự trao phần thưởng ngoài đời, nhóm đó tự chịu trách nhiệm.',
            ],
          },
          {
            id: 'liability',
            title: 'Giới hạn trách nhiệm',
            paragraphs: [
              'Trang được cung cấp như hiện có. Tôi cố gắng để trang chạy ổn định nhưng không bảo đảm luôn không gián đoạn hay không có lỗi; ván đấu, tiến độ hoặc dữ liệu có thể bị mất khi có sự cố. Điều khoản này không loại trừ những quyền và trách nhiệm mà pháp luật không cho phép loại trừ.',
            ],
          },
          {
            id: 'law',
            title: 'Thay đổi và luật áp dụng',
            paragraphs: [
              'Tôi có thể cập nhật điều khoản và ghi ngày cập nhật ở đầu trang. Điều khoản được áp dụng theo pháp luật Việt Nam.',
            ],
            links: [{ href: '/privacy', label: 'Chính sách quyền riêng tư' }],
          },
        ],
      },
    };
  },
};
