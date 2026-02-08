#include "bn_core.h"
#include "bn_sprite_ptr.h"
#include "bn_sprite_text_generator.h"
#include "bn_vector.h"

#include "common_fixed_8x8_sprite_font.h"

int main()
{
    bn::core::init();

    bn::sprite_text_generator text_generator(common::fixed_8x8_sprite_font);
    text_generator.set_center_alignment();

    bn::vector<bn::sprite_ptr, 32> text_sprites;
    text_generator.generate(0, 0, "Hello world!", text_sprites);

    while(true)
    {
        bn::core::update();
    }
}
