
pull:
	git pull
	(cd deps/daemon.node-master && node-waf clean configure build)

clean:
	find . -name \*~ -delete
	rm -f *.log
	rm -f *.pid

tgz:
	tar czvf moon-broker.tgz broker moon-broker.js common modules web deps
	tar czvf moon-daemon.tgz daemon moon-daemon.js common plugins     deps/daemon.node-master

commit:
	git commit -a

push: clean tgz commit
	git push https://github.com/FranPuentes/moonitor.git
