package org.vtsukur.spring.rest.market.domain.integration.ad;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.hateoas.EntityLinks;
import org.springframework.hateoas.Resource;
import org.springframework.hateoas.ResourceProcessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.vtsukur.spring.rest.market.domain.core.ad.Ad;
import org.vtsukur.spring.rest.market.domain.core.ad.AdExcerpt;
import org.vtsukur.spring.rest.market.infrastructure.CustomUserDetailsService;

import static org.springframework.hateoas.mvc.ControllerLinkBuilder.linkTo;
import static org.springframework.hateoas.mvc.ControllerLinkBuilder.methodOn;

/**
 * @author volodymyr.tsukur
 */
@Component
public class AdResourceProcessor implements ResourceProcessor<Resource<AdExcerpt>> {

    @Autowired
    private EntityLinks entityLinks;

    @Override
    public Resource<AdExcerpt> process(Resource<AdExcerpt> resource) {
        AdExcerpt ad = resource.getContent();
        if (hasAccessToModify(ad)) {
            Ad.Status status = ad.getStatus();
            if (status == Ad.Status.NEW) {
                resource.add(entityLinks.linkForSingleResource(Ad.class, ad.getId()).withRel("update"));
                resource.add(entityLinks.linkForSingleResource(Ad.class, ad.getId()).withRel("delete"));
                resource.add(linkTo(methodOn(AdResourceController.class).publish(ad.getId(), null)).withRel("publish"));
            }
            if (status == Ad.Status.PUBLISHED) {
                resource.add(linkTo(methodOn(AdResourceController.class).expire(ad.getId(), null)).withRel("expire"));
            }
        }
        return resource;
    }

    private static boolean hasAccessToModify(AdExcerpt ad) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        CustomUserDetailsService.CustomUserDetails principal = (CustomUserDetailsService.CustomUserDetails) auth.getPrincipal();
        return principal != null && ad.getPhoneNumber().equals(principal.getUsername());
    }

}
