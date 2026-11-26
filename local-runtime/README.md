# BuildSuite üçün yerli iş mühiti

BuildSuite Core, ERPNext v16 və Frappe eyni saytda işləyir. Saytın və ilk administratorun dili Azərbaycan dilidir. Ünvan yalnız bu kompüterdə açılır.

## Giriş

[BuildSuite giriş səhifəsini açın](http://localhost:8765/login?_lang=az&redirect-to=%2Fcore). İstifadəçi adı `Administrator`-dur. İlkin parol bu qovluqdakı `private/administrator-password` faylındadır. Administrator komanda üzvləri üçün ayrıca istifadəçi yarada və vəzifəsinə uyğun BuildSuite rolunu təyin edə bilər. Hər istifadəçi öz hesabı ilə daxil olur.

ERPNext-in iş masasında mühasibat, satınalma, satış, anbar və istehsal sənədlərini eyni hesabla aça bilərsiniz. [ERPNext iş masasını açın](http://localhost:8765/desk) · [Mühasibat uçotu](http://localhost:8765/desk/accounts/accounting)

## Başlatmaq

OrbStack və ya Docker Compose işlək olmalıdır. Layihənin kök qovluğunda bu əmri icra edin.

```sh
./local-runtime/start.sh
```

İlk açılış rəsmi ERPNext təsvirini yükləyir, verilənlər bazasını yaradır və proqramları quraşdırır. Sonrakı açılışlar mövcud sayt məlumatlarını istifadə edir. Vue interfeysinin yığılmış faylları `buildsuite_core/public/frontend/` qovluğundan oxunur. Bu qovluqda `manifest.json` və onun göstərdiyi JS/CSS faylları olmalıdır.

Təzə nüsxədə interfeysi yığmaq və ya mənbə faylları dəyişəndən sonra yeniləmək üçün layihənin kökündən işlədin.

```sh
(cd frontend && CYPRESS_INSTALL_BINARY=0 npm ci --no-audit --no-fund && npm run build)
```

İlk quraşdırmada **BuildSuite Demo** adlı nümunə şirkət yaradılır. Yerli ilkin seçimlər Azərbaycan, AZN və Bakı vaxtıdır. Mövcud saytın şirkət məlumatları yenidən yaradılmır.

## İdarəetmə

Layihənin kökündən aşağıdakı əmrləri işlədin.

| Əməliyyat | Əmr |
| --- | --- |
| Xidmətlərin vəziyyəti | `docker compose -f local-runtime/compose.yaml ps` |
| Məlumatları saxlayaraq xidmətləri dayandırmaq | `docker compose -f local-runtime/compose.yaml stop` |
| Xidmətləri yenidən işə salmaq | `docker compose -f local-runtime/compose.yaml start` |
| Tərcümə cədvəli yenilənəndən sonra keşi təmizləmək | `docker compose -f local-runtime/compose.yaml exec backend bench --site buildsuite.localhost clear-cache` |
| Saytın faylları ilə ehtiyat nüsxəsini yaratmaq | `docker compose -f local-runtime/compose.yaml exec backend bench --site buildsuite.localhost backup --with-files` |

MariaDB məlumatları, sayt faylları, tapşırıq növbəsi və jurnallar `buildsuite-az` layihəsinə məxsus Docker saxlama vahidlərində qalır. Saytın ehtiyat nüsxələri konteynerdə `/home/frappe/frappe-bench/sites/buildsuite.localhost/private/backups/` qovluğuna yazılır. Saxlama vahidlərini silmək həmin məlumatları silir.

İstifadəçi hesabı açarkən dil sahəsində Azərbaycan dilini (`az`) seçin. Mövcud istifadəçi öz dil seçimini hesab ayarlarından dəyişə bilər.

## ERPNext tərcümələrinin yoxlanması

ERPNext və ya Frappe yeniləndikdən sonra quraşdırılmış versiyanın mətnlərini layihənin Azərbaycan dili lüğəti ilə müqayisə etmək üçün bu əmri layihənin kök qovluğunda icra edin.

```sh
docker compose -f local-runtime/compose.yaml exec -T backend bash -c \
  'cd sites && /home/frappe/frappe-bench/env/bin/python - --site buildsuite.localhost' \
  < testing/verify_desk_az.py
```

Yoxlama mənbə mətnlərini, kontekstləri, format arqumentlərini və iş masasına göndərilən tərcümələri müqayisə edir. Yenilənmiş lüğəti mövcud brauzer vərəqində görmək üçün saytın keşini təmizlədikdən sonra səhifəni yeniləyin.
